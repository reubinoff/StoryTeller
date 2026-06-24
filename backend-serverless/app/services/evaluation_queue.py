"""Queue adapter for short writing evaluation jobs."""

from __future__ import annotations

import json
import uuid
from functools import lru_cache
from typing import Protocol

from azure.core.exceptions import ResourceExistsError
from azure.storage.queue.aio import QueueClient
from pydantic import BaseModel, ConfigDict, ValidationError

from app.config import get_settings

WRITING_EVALUATION_KIND = "writing_evaluation"
EVALUATION_MESSAGE_SCHEMA_VERSION = 1


class EvaluationQueueError(RuntimeError):
    """Raised when a writing evaluation job cannot be enqueued."""


class WritingEvaluationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int
    kind: str
    task_id: uuid.UUID


class EvaluationQueueClient(Protocol):
    async def enqueue_writing_evaluation(self, task_id: uuid.UUID) -> None:
        """Persist a writing-evaluation work item."""


class AzureStorageEvaluationQueueClient:
    """Azure Storage Queue implementation used by the Functions app."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.azure_web_jobs_storage:
            raise EvaluationQueueError("AzureWebJobsStorage is not configured.")
        self._queue_name = settings.evaluation_queue_name
        self._create_on_enqueue = settings.create_evaluation_queue_on_enqueue
        self._client = QueueClient.from_connection_string(
            conn_str=settings.azure_web_jobs_storage,
            queue_name=self._queue_name,
        )

    async def enqueue_writing_evaluation(self, task_id: uuid.UUID) -> None:
        payload = writing_evaluation_message(task_id)
        if self._create_on_enqueue:
            try:
                await self._client.create_queue()
            except ResourceExistsError:
                pass
        await self._client.send_message(payload)


class InMemoryEvaluationQueueClient:
    """Test/local helper that records queued task IDs without touching Azure."""

    def __init__(self) -> None:
        self.messages: list[str] = []
        self.task_ids: list[uuid.UUID] = []

    async def enqueue_writing_evaluation(self, task_id: uuid.UUID) -> None:
        payload = writing_evaluation_message(task_id)
        self.messages.append(payload)
        self.task_ids.append(task_id)


_queue_client: EvaluationQueueClient | None = None


def writing_evaluation_message(task_id: uuid.UUID) -> str:
    return json.dumps(
        {
            "schema_version": EVALUATION_MESSAGE_SCHEMA_VERSION,
            "kind": WRITING_EVALUATION_KIND,
            "task_id": str(task_id),
        },
        separators=(",", ":"),
    )


def parse_writing_evaluation_message(raw: str | bytes) -> uuid.UUID:
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    try:
        message = WritingEvaluationMessage.model_validate_json(raw)
    except ValidationError as exc:
        raise ValueError("Invalid writing evaluation queue message.") from exc
    if message.schema_version != EVALUATION_MESSAGE_SCHEMA_VERSION:
        raise ValueError(f"Unsupported writing evaluation schema version: {message.schema_version}")
    if message.kind != WRITING_EVALUATION_KIND:
        raise ValueError(f"Unsupported queue message kind: {message.kind}")
    return message.task_id


@lru_cache(maxsize=1)
def _default_queue_client() -> EvaluationQueueClient:
    return AzureStorageEvaluationQueueClient()


def set_evaluation_queue_client(client: EvaluationQueueClient | None) -> None:
    global _queue_client
    _queue_client = client
    _default_queue_client.cache_clear()


def get_evaluation_queue_client() -> EvaluationQueueClient:
    if _queue_client is not None:
        return _queue_client
    return _default_queue_client()


async def enqueue_writing_evaluation(task_id: uuid.UUID) -> None:
    try:
        await get_evaluation_queue_client().enqueue_writing_evaluation(task_id)
    except EvaluationQueueError:
        raise
    except Exception as exc:
        raise EvaluationQueueError("Unable to enqueue writing evaluation.") from exc
