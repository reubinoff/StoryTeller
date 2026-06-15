"""Tests for the ready-task prewarm queue adapter."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from azure.core.exceptions import ResourceExistsError

from app.services import task_prewarm_queue as queue_module
from app.services.task_prewarm_queue import (
    AzureStorageTaskPrewarmQueueClient,
    InMemoryTaskPrewarmQueueClient,
    TaskPrewarmQueueError,
    enqueue_task_prewarm,
    parse_task_prewarm_message,
    set_task_prewarm_queue_client,
    task_prewarm_message,
)


def test_task_prewarm_message_round_trips_job() -> None:
    user_id = uuid.uuid4()

    payload = task_prewarm_message(user_id, "reading")

    assert parse_task_prewarm_message(payload) == (user_id, "reading")


def test_parse_rejects_malformed_json() -> None:
    with pytest.raises(ValueError, match="Invalid task prewarm"):
        parse_task_prewarm_message("{not-json")


def test_parse_rejects_unknown_schema_version() -> None:
    user_id = uuid.uuid4()
    payload = (
        '{"schema_version":2,"kind":"task_prewarm",'
        f'"user_id":"{user_id}","course_id":"reading"}}'
    )

    with pytest.raises(ValueError, match="Unsupported task prewarm schema"):
        parse_task_prewarm_message(payload)


def test_parse_rejects_unknown_kind() -> None:
    user_id = uuid.uuid4()
    payload = (
        '{"schema_version":1,"kind":"other",'
        f'"user_id":"{user_id}","course_id":"reading"}}'
    )

    with pytest.raises(ValueError, match="Unsupported queue message kind"):
        parse_task_prewarm_message(payload)


def test_parse_rejects_extra_fields() -> None:
    user_id = uuid.uuid4()
    payload = (
        '{"schema_version":1,"kind":"task_prewarm",'
        f'"user_id":"{user_id}","course_id":"reading","extra":true}}'
    )

    with pytest.raises(ValueError, match="Invalid task prewarm"):
        parse_task_prewarm_message(payload)


@pytest.mark.asyncio
async def test_in_memory_queue_records_payloads() -> None:
    user_id = uuid.uuid4()
    queue = InMemoryTaskPrewarmQueueClient()

    await queue.enqueue_task_prewarm(user_id, "writing")

    assert queue.jobs == [(user_id, "writing")]
    assert parse_task_prewarm_message(queue.messages[0]) == (user_id, "writing")


def test_azure_queue_client_requires_storage_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        queue_module,
        "get_settings",
        lambda: SimpleNamespace(
            azure_web_jobs_storage="",
            task_prewarm_queue_name="task-prewarm-tests",
            create_task_prewarm_queue_on_enqueue=True,
        ),
    )

    with pytest.raises(TaskPrewarmQueueError, match="AzureWebJobsStorage"):
        AzureStorageTaskPrewarmQueueClient()


@pytest.mark.asyncio
async def test_azure_queue_client_creates_queue_and_sends_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeQueueClient:
        def __init__(self) -> None:
            self.create_calls = 0
            self.messages: list[str] = []

        async def create_queue(self) -> None:
            self.create_calls += 1

        async def send_message(self, payload: str) -> None:
            self.messages.append(payload)

    fake = FakeQueueClient()
    captured: dict[str, str] = {}

    def from_connection_string(*, conn_str: str, queue_name: str) -> FakeQueueClient:
        captured["conn_str"] = conn_str
        captured["queue_name"] = queue_name
        return fake

    monkeypatch.setattr(
        queue_module,
        "get_settings",
        lambda: SimpleNamespace(
            azure_web_jobs_storage="UseDevelopmentStorage=true",
            task_prewarm_queue_name="task-prewarm-tests",
            create_task_prewarm_queue_on_enqueue=True,
        ),
    )
    monkeypatch.setattr(
        queue_module.QueueClient,
        "from_connection_string",
        from_connection_string,
    )
    client = AzureStorageTaskPrewarmQueueClient()
    user_id = uuid.uuid4()

    await client.enqueue_task_prewarm(user_id, "reading")

    assert captured == {
        "conn_str": "UseDevelopmentStorage=true",
        "queue_name": "task-prewarm-tests",
    }
    assert fake.create_calls == 1
    assert parse_task_prewarm_message(fake.messages[0]) == (user_id, "reading")


@pytest.mark.asyncio
async def test_azure_queue_client_ignores_existing_queue_on_create(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeQueueClient:
        def __init__(self) -> None:
            self.messages: list[str] = []

        async def create_queue(self) -> None:
            raise ResourceExistsError("exists")

        async def send_message(self, payload: str) -> None:
            self.messages.append(payload)

    fake = FakeQueueClient()
    monkeypatch.setattr(
        queue_module,
        "get_settings",
        lambda: SimpleNamespace(
            azure_web_jobs_storage="UseDevelopmentStorage=true",
            task_prewarm_queue_name="task-prewarm-tests",
            create_task_prewarm_queue_on_enqueue=True,
        ),
    )
    monkeypatch.setattr(
        queue_module.QueueClient,
        "from_connection_string",
        lambda *, conn_str, queue_name: fake,
    )
    client = AzureStorageTaskPrewarmQueueClient()
    user_id = uuid.uuid4()

    await client.enqueue_task_prewarm(user_id, "writing")

    assert parse_task_prewarm_message(fake.messages[0]) == (user_id, "writing")


@pytest.mark.asyncio
async def test_enqueue_task_prewarm_wraps_unexpected_adapter_errors() -> None:
    class BrokenQueueClient:
        async def enqueue_task_prewarm(self, user_id: uuid.UUID, course_id: str) -> None:
            raise RuntimeError("boom")

    set_task_prewarm_queue_client(BrokenQueueClient())
    try:
        with pytest.raises(TaskPrewarmQueueError, match="Unable to enqueue"):
            await enqueue_task_prewarm(uuid.uuid4(), "reading")
    finally:
        set_task_prewarm_queue_client(None)
