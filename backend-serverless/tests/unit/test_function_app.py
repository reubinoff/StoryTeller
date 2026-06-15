"""Tests for Azure Functions worker entrypoints."""

from __future__ import annotations

import uuid

import pytest

import function_app
from app.services.evaluation_queue import writing_evaluation_message
from app.services.task_prewarm_queue import task_prewarm_message


class FakeQueueMessage:
    def __init__(self, body: bytes) -> None:
        self._body = body

    def get_body(self) -> bytes:
        return self._body


@pytest.mark.asyncio
async def test_writing_evaluation_worker_invokes_evaluation(monkeypatch) -> None:
    task_id = uuid.uuid4()
    calls: list[uuid.UUID] = []

    async def _capture(captured_task_id: uuid.UUID) -> None:
        calls.append(captured_task_id)

    monkeypatch.setattr(function_app, "run_writing_evaluation", _capture)

    await function_app.writing_evaluation_worker(
        FakeQueueMessage(writing_evaluation_message(task_id).encode("utf-8"))
    )

    assert calls == [task_id]


@pytest.mark.asyncio
async def test_writing_evaluation_worker_rejects_bad_payload() -> None:
    with pytest.raises(ValueError, match="Invalid writing evaluation"):
        await function_app.writing_evaluation_worker(FakeQueueMessage(b"not-json"))


@pytest.mark.asyncio
async def test_task_prewarm_worker_invokes_prewarm(monkeypatch) -> None:
    user_id = uuid.uuid4()
    calls: list[tuple[uuid.UUID, str]] = []

    async def _capture(captured_user_id: uuid.UUID, captured_course_id: str) -> None:
        calls.append((captured_user_id, captured_course_id))

    monkeypatch.setattr(function_app, "run_task_prewarm", _capture)

    await function_app.task_prewarm_worker(
        FakeQueueMessage(task_prewarm_message(user_id, "writing").encode("utf-8"))
    )

    assert calls == [(user_id, "writing")]


@pytest.mark.asyncio
async def test_task_prewarm_worker_rejects_bad_payload() -> None:
    with pytest.raises(ValueError, match="Invalid task prewarm"):
        await function_app.task_prewarm_worker(FakeQueueMessage(b"not-json"))
