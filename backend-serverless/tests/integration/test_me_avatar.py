"""Avatar endpoint tests."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.core.security import create_access_token
from app.core.session_cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.db.models.user import User
from app.services.avatar_service import AvatarBlob, AvatarContentType, set_avatar_store


class FakeAvatarStore:
    def __init__(self) -> None:
        self.avatars: dict[uuid.UUID, AvatarBlob] = {}
        self.uploads: list[tuple[uuid.UUID, bytes, AvatarContentType]] = []

    async def upload_user_avatar(
        self, user_id: uuid.UUID, content: bytes, content_type: AvatarContentType
    ) -> None:
        self.uploads.append((user_id, content, content_type))
        self.avatars[user_id] = AvatarBlob(content=content, content_type=content_type)

    async def get_user_avatar(self, user_id: uuid.UUID) -> AvatarBlob | None:
        return self.avatars.get(user_id)


async def create_authenticated_user(
    client: AsyncClient, db_engine, email: str = "avatar@example.com"
) -> tuple[User, dict[str, str]]:
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        user = User(
            email=email,
            email_verified_at=None,
            first_name="Maya",
            last_name="Patel",
            year_of_birth=2017,
            grade_level=4,
            phone_number=None,
            avatar_url=None,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    token, _expires_in = create_access_token(str(user.id))
    csrf_token = "test-csrf-token"
    client.cookies.set(ACCESS_COOKIE, token)
    client.cookies.set(CSRF_COOKIE, csrf_token)
    return user, {"X-CSRF-Token": csrf_token}


@pytest_asyncio.fixture
async def avatar_store() -> AsyncIterator[FakeAvatarStore]:
    store = FakeAvatarStore()
    set_avatar_store(store)
    try:
        yield store
    finally:
        set_avatar_store(None)


@pytest.mark.asyncio
async def test_upload_avatar_stores_file_and_updates_user(
    client: AsyncClient, db_engine, avatar_store: FakeAvatarStore
) -> None:
    user, headers = await create_authenticated_user(client, db_engine)
    content = b"\x89PNG\r\n\x1a\navatar"

    resp = await client.post(
        "/me/avatar",
        headers=headers,
        files={"file": ("avatar.png", content, "image/png")},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["avatar_url"].startswith("/api/v1/me/avatar?version=")
    assert avatar_store.uploads == [(user.id, content, "image/png")]

    me = await client.get("/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["avatar_url"] == body["avatar_url"]


@pytest.mark.asyncio
async def test_get_avatar_serves_authenticated_users_file(
    client: AsyncClient, db_engine, avatar_store: FakeAvatarStore
) -> None:
    user, headers = await create_authenticated_user(client, db_engine)
    content = b"RIFFxxxxWEBPavatar"
    upload = await client.post(
        "/me/avatar",
        headers=headers,
        files={"file": ("avatar.webp", content, "image/webp")},
    )
    assert upload.status_code == 200, upload.text

    resp = await client.get("/me/avatar", headers=headers)

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/webp"
    assert resp.content == content


@pytest.mark.asyncio
async def test_get_avatar_returns_404_before_upload(
    client: AsyncClient, db_engine, avatar_store: FakeAvatarStore  # noqa: ARG001
) -> None:
    _user, headers = await create_authenticated_user(client, db_engine)

    resp = await client.get("/me/avatar", headers=headers)

    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


@pytest.mark.asyncio
async def test_upload_avatar_rejects_unsupported_content_type(
    client: AsyncClient, db_engine, avatar_store: FakeAvatarStore
) -> None:
    _user, headers = await create_authenticated_user(client, db_engine)

    resp = await client.post(
        "/me/avatar",
        headers=headers,
        files={"file": ("avatar.gif", b"GIF89a", "image/gif")},
    )

    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"
    assert avatar_store.uploads == []


@pytest.mark.asyncio
async def test_upload_avatar_rejects_files_over_two_mib(
    client: AsyncClient, db_engine, avatar_store: FakeAvatarStore
) -> None:
    _user, headers = await create_authenticated_user(client, db_engine)
    content = b"x" * (2 * 1024 * 1024 + 1)

    resp = await client.post(
        "/me/avatar",
        headers=headers,
        files={"file": ("avatar.jpg", content, "image/jpeg")},
    )

    assert resp.status_code == 413
    assert resp.json()["code"] == "validation_error"
    assert avatar_store.uploads == []
