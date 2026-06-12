"""Task endpoints: roll, list, get, start, answer, submit, draft, retry, result."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.common import Page
from app.api.v1.schemas.task import (
    AnswerAccepted,
    AnswerQuestionRequest,
    ReadingSubmitRequest,
    ReadingSubmitResponse,
    RollTaskRequest,
    TaskOut,
    TaskStatus,
    WritingDraftRequest,
    WritingDraftResponse,
    WritingSubmitAccepted,
    WritingSubmitRequest,
)
from app.core.errors import AppError
from app.db.models.task import Task
from app.deps import CurrentUser, DbSession
from app.services import task_service
from app.services.evaluation_queue import EvaluationQueueError, enqueue_writing_evaluation

router = APIRouter(tags=["tasks"])


@router.post(
    "/courses/{course_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def roll_task(
    course_id: str,
    body: RollTaskRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> TaskOut:
    if course_id not in {"reading", "writing"}:
        raise AppError(status_code=404, code="not_found", title="Unknown course")
    task = await task_service.roll_task(
        db,
        user=current_user,
        course_slug=course_id,
        override_interest=body.interest_id,
    )
    return await task_service.task_to_out(db, task)


@router.get("/tasks", response_model=Page[TaskOut])
async def list_tasks(
    current_user: CurrentUser,
    db: DbSession,
    status_q: Annotated[TaskStatus | None, Query(alias="status")] = None,
    course_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query()] = None,  # noqa: ARG001
) -> Page[TaskOut]:
    rows = await task_service.list_tasks(
        db,
        user_id=current_user.id,
        status=status_q,
        course_type=course_type,
        limit=limit,
    )
    items = [await task_service.task_to_out(db, t) for t in rows]
    return Page(items=items, next_cursor=None)


def _parse_task_id(task_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(task_id)
    except ValueError as exc:
        raise AppError(status_code=404, code="not_found", title="Task not found") from exc


async def _enqueue_evaluation_or_fail(db: AsyncSession, task: Task) -> None:
    try:
        await enqueue_writing_evaluation(task.id)
    except EvaluationQueueError as exc:
        await task_service.mark_writing_evaluation_failed(
            db,
            task=task,
            reason="Evaluation queue unavailable",
        )
        raise AppError(
            status_code=503,
            code="unavailable",
            title="Evaluation queue unavailable",
            detail="The writing evaluation could not be queued. Try again shortly.",
        ) from exc


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str, current_user: CurrentUser, db: DbSession
) -> TaskOut:
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    return await task_service.task_to_out(db, task)


@router.patch("/tasks/{task_id}/start", response_model=TaskOut)
async def start_task(
    task_id: str, current_user: CurrentUser, db: DbSession
) -> TaskOut:
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    task = await task_service.start_task(db, task)
    return await task_service.task_to_out(db, task)


@router.post("/tasks/{task_id}/answer", response_model=AnswerAccepted)
async def answer_question(
    task_id: str,
    body: AnswerQuestionRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> AnswerAccepted:
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    await task_service.record_answer(
        db, task=task, question_id=body.question_id, answer=body.answer
    )
    return AnswerAccepted(accepted=True)


@router.post("/tasks/{task_id}/submit")
async def submit_task(
    task_id: str,
    body: Annotated[dict[str, object], Body()],
    current_user: CurrentUser,
    db: DbSession,
):
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    if task.course_type == "unseen_text":
        parsed = ReadingSubmitRequest.model_validate(body)
        answers_map: dict[uuid.UUID, str | int] = {a.question_id: a.answer for a in parsed.answers}
        correct, total = await task_service.submit_reading(db, task=task, answers=answers_map)
        out = await task_service.task_to_out(db, task)
        return ReadingSubmitResponse(**out.model_dump(), correct_count=correct, total=total)

    if task.course_type == "short_writing":
        parsed_w = WritingSubmitRequest.model_validate(body)
        task = await task_service.submit_writing(db, task=task, full_text=parsed_w.full_text)
        await _enqueue_evaluation_or_fail(db, task)
        from fastapi.responses import JSONResponse

        payload = WritingSubmitAccepted(
            id=task.id, status=task.status, submitted_at=task.submitted_at  # type: ignore[arg-type]
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=payload.model_dump(mode="json"),
        )

    raise AppError(status_code=400, code="invalid_state", title="Unsupported task type")


@router.post("/tasks/{task_id}/draft", response_model=WritingDraftResponse)
async def save_draft(
    task_id: str,
    body: WritingDraftRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> WritingDraftResponse:
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    saved_at = await task_service.save_writing_draft(db, task=task, text=body.text)
    return WritingDraftResponse(saved_at=saved_at)


@router.post(
    "/tasks/{task_id}/retry",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=WritingSubmitAccepted,
)
async def retry_task(
    task_id: str,
    current_user: CurrentUser,
    db: DbSession,
) -> WritingSubmitAccepted:
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    task = await task_service.retry_writing(db, task=task)
    await _enqueue_evaluation_or_fail(db, task)
    return WritingSubmitAccepted(
        id=task.id,
        status=task.status,  # type: ignore[arg-type]
        submitted_at=task.submitted_at,
    )


@router.get("/tasks/{task_id}/result")
async def get_result(
    task_id: str, current_user: CurrentUser, db: DbSession
):
    task = await task_service.get_owned_task(
        db, user_id=current_user.id, task_id=_parse_task_id(task_id)
    )
    if task.course_type == "unseen_text":
        if task.status != "completed":
            raise AppError(
                status_code=400,
                code="invalid_state",
                title="Task is not completed yet",
            )
        return await task_service.reading_result(db, task)
    if task.course_type == "short_writing":
        return await task_service.writing_result(db, task)
    raise AppError(status_code=400, code="invalid_state", title="Unknown task type")
