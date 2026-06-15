"""Queue adapter for ready-task prewarm jobs."""

from __future__ import annotations

import json
import uuid
from functools import lru_cache
from typing import Literal, Protocol

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue.aio import QueueClient
from pydantic import BaseModel, ConfigDict, ValidationError

from app.config import get_settings

TaskPrewarmCourseId = Literal["reading", "writing"]

TASK_PREWARM_KIND = "task_prewarm"
TASK_PREWARM_MESSAGE_SCHEMA_VERSION = 1


class TaskPrewarmQueueError(RuntimeError):
    """Raised when a ready-task prewarm job cannot be enqueued."""


class TaskPrewarmMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int
    kind: str
    user_id: uuid.UUID
    course_id: TaskPrewarmCourseId


class TaskPrewarmQueueClient(Protocol):
    async def enqueue_task_prewarm(
        self, user_id: uuid.UUID, course_id: TaskPrewarmCourseId
    ) -> None:
        """Persist a ready-task prewarm work item."""


class AzureStorageTaskPrewarmQueueClient:
    """Azure Storage Queue implementation used by the Functions app."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.azure_web_jobs_storage:
            raise TaskPrewarmQueueError("AzureWebJobsStorage is not configured.")
        self._queue_name = settings.task_prewarm_queue_name
        self._create_on_enqueue = settings.create_task_prewarm_queue_on_enqueue
        self._client = QueueClient.from_connection_string(
            conn_str=settings.azure_web_jobs_storage,
            queue_name=self._queue_name,
        )

    async def enqueue_task_prewarm(
        self, user_id: uuid.UUID, course_id: TaskPrewarmCourseId
    ) -> None:
        payload = task_prewarm_message(user_id, course_id)
        if self._create_on_enqueue:
            try:
                await self._client.create_queue()
            except ResourceExistsError:
                pass
        await self._client.send_message(payload)


class InMemoryTaskPrewarmQueueClient:
    """Test/local helper that records queued ready-task prewarm jobs."""

    def __init__(self) -> None:
        self.messages: list[str] = []
        self.jobs: list[tuple[uuid.UUID, TaskPrewarmCourseId]] = []

    async def enqueue_task_prewarm(
        self, user_id: uuid.UUID, course_id: TaskPrewarmCourseId
    ) -> None:
        payload = task_prewarm_message(user_id, course_id)
        self.messages.append(payload)
        self.jobs.append((user_id, course_id))


_queue_client: TaskPrewarmQueueClient | None = None


def task_prewarm_message(user_id: uuid.UUID, course_id: TaskPrewarmCourseId) -> str:
    return json.dumps(
        {
            "schema_version": TASK_PREWARM_MESSAGE_SCHEMA_VERSION,
            "kind": TASK_PREWARM_KIND,
            "user_id": str(user_id),
            "course_id": course_id,
        },
        separators=(",", ":"),
    )


def parse_task_prewarm_message(raw: str | bytes) -> tuple[uuid.UUID, TaskPrewarmCourseId]:
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        message = TaskPrewarmMessage.model_validate_json(raw)
    except ValidationError as exc:
        raise ValueError("Invalid task prewarm queue message.") from exc
    if message.schema_version != TASK_PREWARM_MESSAGE_SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported task prewarm schema version: {message.schema_version}"
        )
    if message.kind != TASK_PREWARM_KIND:
        raise ValueError(f"Unsupported queue message kind: {message.kind}")
    return message.user_id, message.course_id


@lru_cache(maxsize=1)
def _default_queue_client() -> TaskPrewarmQueueClient:
    return AzureStorageTaskPrewarmQueueClient()


def set_task_prewarm_queue_client(client: TaskPrewarmQueueClient | None) -> None:
    global _queue_client
    _queue_client = client
    _default_queue_client.cache_clear()


def get_task_prewarm_queue_client() -> TaskPrewarmQueueClient:
    if _queue_client is not None:
        return _queue_client
    return _default_queue_client()


async def enqueue_task_prewarm(
    user_id: uuid.UUID, course_id: TaskPrewarmCourseId
) -> None:
    try:
        await get_task_prewarm_queue_client().enqueue_task_prewarm(user_id, course_id)
    except TaskPrewarmQueueError:
        raise
    except Exception as exc:
        raise TaskPrewarmQueueError("Unable to enqueue task prewarm.") from exc
