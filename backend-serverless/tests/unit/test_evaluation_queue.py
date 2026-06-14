"""Tests for the Azure Storage Queue message adapter."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from azure.core.exceptions import ResourceExistsError

from app.services import evaluation_queue as queue_module
from app.services.evaluation_queue import (
    AzureStorageEvaluationQueueClient,
    EvaluationQueueError,
    InMemoryEvaluationQueueClient,
    enqueue_writing_evaluation,
    parse_writing_evaluation_message,
    set_evaluation_queue_client,
    writing_evaluation_message,
)


def test_writing_evaluation_message_round_trips_task_id() -> None:
    task_id = uuid.uuid4()

    payload = writing_evaluation_message(task_id)

    assert parse_writing_evaluation_message(payload) == task_id


def test_parse_rejects_malformed_json() -> None:
    with pytest.raises(ValueError, match="Invalid writing evaluation"):
        parse_writing_evaluation_message("{not-json")


def test_parse_rejects_unknown_schema_version() -> None:
    task_id = uuid.uuid4()
    payload = (
        '{"schema_version":2,"kind":"writing_evaluation",'
        f'"task_id":"{task_id}"}}'
    )

    with pytest.raises(ValueError, match="Unsupported writing evaluation schema"):
        parse_writing_evaluation_message(payload)


def test_parse_rejects_unknown_kind() -> None:
    task_id = uuid.uuid4()
    payload = (
        '{"schema_version":1,"kind":"other",'
        f'"task_id":"{task_id}"}}'
    )

    with pytest.raises(ValueError, match="Unsupported queue message kind"):
        parse_writing_evaluation_message(payload)


def test_parse_rejects_extra_fields() -> None:
    task_id = uuid.uuid4()
    payload = (
        '{"schema_version":1,"kind":"writing_evaluation",'
        f'"task_id":"{task_id}","extra":true}}'
    )

    with pytest.raises(ValueError, match="Invalid writing evaluation"):
        parse_writing_evaluation_message(payload)


@pytest.mark.asyncio
async def test_in_memory_queue_records_payloads() -> None:
    task_id = uuid.uuid4()
    queue = InMemoryEvaluationQueueClient()

    await queue.enqueue_writing_evaluation(task_id)

    assert queue.task_ids == [task_id]
    assert parse_writing_evaluation_message(queue.messages[0]) == task_id


def test_azure_queue_client_requires_storage_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        queue_module,
        "get_settings",
        lambda: SimpleNamespace(
            azure_web_jobs_storage="",
            evaluation_queue_name="writing-tests",
            create_evaluation_queue_on_enqueue=True,
        ),
    )

    with pytest.raises(EvaluationQueueError, match="AzureWebJobsStorage"):
        AzureStorageEvaluationQueueClient()


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
            evaluation_queue_name="writing-tests",
            create_evaluation_queue_on_enqueue=True,
        ),
    )
    monkeypatch.setattr(
        queue_module.QueueClient,
        "from_connection_string",
        from_connection_string,
    )
    client = AzureStorageEvaluationQueueClient()
    task_id = uuid.uuid4()

    await client.enqueue_writing_evaluation(task_id)

    assert captured == {
        "conn_str": "UseDevelopmentStorage=true",
        "queue_name": "writing-tests",
    }
    assert fake.create_calls == 1
    assert parse_writing_evaluation_message(fake.messages[0]) == task_id


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
            evaluation_queue_name="writing-tests",
            create_evaluation_queue_on_enqueue=True,
        ),
    )
    monkeypatch.setattr(
        queue_module.QueueClient,
        "from_connection_string",
        lambda *, conn_str, queue_name: fake,
    )
    client = AzureStorageEvaluationQueueClient()
    task_id = uuid.uuid4()

    await client.enqueue_writing_evaluation(task_id)

    assert parse_writing_evaluation_message(fake.messages[0]) == task_id


@pytest.mark.asyncio
async def test_enqueue_writing_evaluation_wraps_unexpected_adapter_errors() -> None:
    class BrokenQueueClient:
        async def enqueue_writing_evaluation(self, task_id: uuid.UUID) -> None:
            raise RuntimeError("boom")

    set_evaluation_queue_client(BrokenQueueClient())
    try:
        with pytest.raises(EvaluationQueueError, match="Unable to enqueue"):
            await enqueue_writing_evaluation(uuid.uuid4())
    finally:
        set_evaluation_queue_client(None)
