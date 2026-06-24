"""Avatar storage service backed by Azure Blob Storage."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol

from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient

from app.config import get_settings

MAX_AVATAR_BYTES = 2 * 1024 * 1024
AvatarContentType = Literal["image/png", "image/jpeg", "image/webp"]
AVATAR_CONTENT_TYPES: frozenset[AvatarContentType] = frozenset(("image/png", "image/jpeg", "image/webp"))


class AvatarValidationError(ValueError):
    """Raised when an uploaded avatar fails validation."""


class AvatarStorageError(RuntimeError):
    """Raised when avatar storage cannot complete an operation."""


@dataclass(frozen=True)
class AvatarBlob:
    content: bytes
    content_type: AvatarContentType


class AvatarStore(Protocol):
    async def upload_user_avatar(self, user_id: uuid.UUID, content: bytes, content_type: AvatarContentType) -> None:
        """Persist avatar bytes for a user."""

    async def get_user_avatar(self, user_id: uuid.UUID) -> AvatarBlob | None:
        """Fetch avatar bytes for a user, if present."""


class AzureBlobAvatarStore:
    """Azure Blob Storage implementation for user avatars."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.azure_web_jobs_storage:
            raise AvatarStorageError("AzureWebJobsStorage is not configured.")
        self._container_client = BlobServiceClient.from_connection_string(
            conn_str=settings.azure_web_jobs_storage,
        ).get_container_client(settings.avatar_container_name)

    async def upload_user_avatar(self, user_id: uuid.UUID, content: bytes, content_type: AvatarContentType) -> None:
        try:
            await self._container_client.create_container()
        except ResourceExistsError:
            pass
        blob_client = self._container_client.get_blob_client(_blob_name(user_id))
        await blob_client.upload_blob(
            content,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type),
        )

    async def get_user_avatar(self, user_id: uuid.UUID) -> AvatarBlob | None:
        blob_client = self._container_client.get_blob_client(_blob_name(user_id))
        try:
            properties = await blob_client.get_blob_properties()
            downloader = await blob_client.download_blob()
            content = await downloader.readall()
        except ResourceNotFoundError:
            return None
        content_type = normalize_avatar_content_type(properties.content_settings.content_type)
        return AvatarBlob(content=content, content_type=content_type)


class InMemoryAvatarStore:
    """Test/local helper that stores avatars without touching Azure."""

    def __init__(self) -> None:
        self.avatars: dict[uuid.UUID, AvatarBlob] = {}

    async def upload_user_avatar(self, user_id: uuid.UUID, content: bytes, content_type: AvatarContentType) -> None:
        self.avatars[user_id] = AvatarBlob(content=content, content_type=content_type)

    async def get_user_avatar(self, user_id: uuid.UUID) -> AvatarBlob | None:
        return self.avatars.get(user_id)


_avatar_store: AvatarStore | None = None


def _blob_name(user_id: uuid.UUID) -> str:
    return f"users/{user_id}/avatar"


def avatar_url() -> str:
    return f"/api/v1/me/avatar?version={uuid.uuid4().hex}"


def normalize_avatar_content_type(content_type: str | None) -> AvatarContentType:
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized not in AVATAR_CONTENT_TYPES:
        raise AvatarValidationError("Avatar must be a PNG, JPEG, or WebP image.")
    return normalized


def validate_avatar_size(content: bytes) -> None:
    if len(content) > MAX_AVATAR_BYTES:
        raise AvatarValidationError("Avatar must be 2 MiB or smaller.")


@lru_cache(maxsize=1)
def _default_avatar_store() -> AvatarStore:
    return AzureBlobAvatarStore()


def set_avatar_store(store: AvatarStore | None) -> None:
    global _avatar_store
    _avatar_store = store
    _default_avatar_store.cache_clear()


def get_avatar_store() -> AvatarStore:
    if _avatar_store is not None:
        return _avatar_store
    return _default_avatar_store()


async def upload_user_avatar(user_id: uuid.UUID, content: bytes, content_type: AvatarContentType) -> str:
    validate_avatar_size(content)
    try:
        await get_avatar_store().upload_user_avatar(user_id, content, content_type)
    except AvatarStorageError:
        raise
    except Exception as exc:
        raise AvatarStorageError("Unable to upload avatar.") from exc
    return avatar_url()


async def get_user_avatar(user_id: uuid.UUID) -> AvatarBlob | None:
    try:
        return await get_avatar_store().get_user_avatar(user_id)
    except AvatarValidationError:
        raise
    except AvatarStorageError:
        raise
    except Exception as exc:
        raise AvatarStorageError("Unable to fetch avatar.") from exc
