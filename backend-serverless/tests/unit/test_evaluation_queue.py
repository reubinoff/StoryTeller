"""Tests for the Azure Storage Queue message adapter."""

from __future__ import annotations

import uuid

import pytest

from app.services.evaluation_queue import (
    InMemoryEvaluationQueueClient,
    parse_writing_evaluation_message,
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


@pytest.mark.asyncio
async def test_in_memory_queue_records_payloads() -> None:
    task_id = uuid.uuid4()
    queue = InMemoryEvaluationQueueClient()

    await queue.enqueue_writing_evaluation(task_id)

    assert queue.task_ids == [task_id]
    assert parse_writing_evaluation_message(queue.messages[0]) == task_id
