"""Async writing evaluation, kicked from a FastAPI BackgroundTask.

The route enqueues `run_writing_evaluation(task_id)`. We open our own DB
session here so the background work outlives the HTTP request scope.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.task import PASSING_SCORE
from app.db.models._helpers import utcnow
from app.db.models.content import WritingPrompt
from app.db.models.notification import Notification
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_evaluation import TaskEvaluation
from app.db.session import get_sessionmaker
from app.services import content_service, task_service

LOGGER = logging.getLogger(__name__)
_EVALUATION_LOCKS: dict[uuid.UUID, asyncio.Lock] = {}


async def run_writing_evaluation(task_id: uuid.UUID) -> None:
    """BackgroundTask entrypoint: scores a submitted writing task with an LLM."""
    lock = _EVALUATION_LOCKS.setdefault(task_id, asyncio.Lock())
    async with lock:
        sm = get_sessionmaker()
        async with sm() as db:
            await _run(db, task_id)


async def _run(db: AsyncSession, task_id: uuid.UUID) -> None:
    task = await db.get(Task, task_id)
    if task is None or task.course_type != "short_writing":
        LOGGER.warning("evaluate_writing_task: task missing or wrong type id=%s", task_id)
        return

    if task.status not in ("processing", "submitted"):
        LOGGER.info("evaluate_writing_task: skipping task in status=%s", task.status)
        return

    prompt = (
        await db.get(WritingPrompt, task.writing_prompt_id) if task.writing_prompt_id else None
    )
    if prompt is None:
        await _mark_failed(db, task, "Missing writing prompt")
        return

    submitted_answer = await _load_full_text_answer(db, task_id)
    answer_text = submitted_answer if submitted_answer is not None else task.writing_draft or ""

    if not answer_text.strip():
        await _mark_failed(db, task, "No submission text")
        return

    try:
        content_grade_level = content_service.content_grade_for_school_grade(
            task.grade_level_at_roll
        )
        evaluation, latency_ms, model_name = await content_service.evaluate_writing(
            school_grade_level=task.grade_level_at_roll,
            content_grade_level=content_grade_level,
            topic_label=task.topic_label,
            prompt_text=prompt.prompt,
            min_words=prompt.min_words,
            max_words=prompt.max_words,
            submitted_word_count=content_service.writing_submission_word_count(answer_text),
            student_answer=answer_text,
        )
    except Exception:
        LOGGER.exception("LLM evaluation failed for task %s", task_id)
        await _mark_failed(db, task, "Evaluation failed")
        return

    existing_eval = await db.scalar(
        select(TaskEvaluation.id).where(TaskEvaluation.task_id == task.id)
    )
    if existing_eval is not None:
        LOGGER.info("evaluate_writing_task: evaluation already exists id=%s", task_id)
        return

    task_eval = TaskEvaluation(
        task_id=task.id,
        model=model_name,
        prompt_version="v2",
        score_overall=float(evaluation.score_overall),
        score_grammar=float(evaluation.score_grammar),
        score_vocabulary=float(evaluation.score_vocabulary),
        score_structure=float(evaluation.score_structure),
        score_relevance=float(evaluation.score_relevance),
        feedback_summary=evaluation.feedback_summary,
        feedback_detail=evaluation.feedback_detail,
        focus_next=evaluation.focus_next,
        highlights=[h.model_dump() for h in evaluation.highlights],
        raw_response=cast("dict[str, object]", evaluation.model_dump()),
        latency_ms=latency_ms,
    )
    db.add(task_eval)

    task.score = float(evaluation.score_overall)
    passed = task.score >= PASSING_SCORE
    task.status = "completed" if passed else "needs_retry"
    task.completed_at = utcnow()
    task.xp_awarded = max(task.xp_awarded, 80) if passed else 0

    db.add(
        Notification(
            user_id=task.user_id,
            kind="task_completed",
            payload={
                "task_id": str(task.id),
                "course_type": task.course_type,
                "title": task.title,
                "score": task.score,
            },
        )
    )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        LOGGER.info("evaluate_writing_task: duplicate evaluation skipped id=%s", task_id)
        return
    if passed:
        await task_service.ensure_next_task_ready(
            db,
            user_id=task.user_id,
            course_slug=task.course_slug,
            exclude_task_id=task.id,
        )


async def _load_full_text_answer(db: AsyncSession, task_id: uuid.UUID) -> str | None:
    rows = await db.execute(
        select(TaskAnswer).where(
            TaskAnswer.task_id == task_id, TaskAnswer.question_id.is_(None)
        )
    )
    record = rows.scalar_one_or_none()
    return record.answer_text if record is not None else None


async def _mark_failed(db: AsyncSession, task: Task, reason: str) -> None:
    task.status = "failed"
    task.failed_at = utcnow()
    task.fail_reason = reason
    db.add(
        Notification(
            user_id=task.user_id,
            kind="task_failed",
            payload={
                "task_id": str(task.id),
                "course_type": task.course_type,
                "title": task.title,
                "reason": reason,
            },
        )
    )
    await db.commit()
