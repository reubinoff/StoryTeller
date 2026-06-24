"""Task lifecycle service: roll, start, answer, submit, draft, retry, result."""

from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.content import READING_QUESTION_COUNT
from app.api.v1.schemas.task import (
    PASSING_SCORE,
    ReadingPayloadOut,
    ReadingResultOut,
    ReadingResultQuestion,
    ReadyTaskSummary,
    TaskOut,
    TaskQuestionOut,
    WritingEvaluationOut,
    WritingPayloadOut,
    WritingResultOut,
)
from app.core.errors import AppError
from app.core.grading import is_correct_answer, reading_xp
from app.db.models._helpers import utcnow
from app.db.models.content import ContentPassage, WritingPrompt
from app.db.models.course import Course
from app.db.models.interest import Interest, UserInterest
from app.db.models.notification import Notification
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_evaluation import TaskEvaluation
from app.db.models.task_question import TaskQuestion
from app.db.models.user import User
from app.services import content_service
from app.services.task_prewarm_queue import (
    TaskPrewarmCourseId,
    TaskPrewarmQueueError,
    enqueue_task_prewarm,
)

LOGGER = logging.getLogger(__name__)


ROLL_BLOCKER_PRIORITY = (
    "in_progress",
    "processing",
    "submitted",
    "needs_retry",
    "failed",
    "not_started",
)

COURSE_SLUGS: tuple[TaskPrewarmCourseId, TaskPrewarmCourseId] = ("reading", "writing")


# ---------- helpers ----------


async def _user_interest_slugs(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await db.execute(select(UserInterest.interest_slug).where(UserInterest.user_id == user_id))
    return [r[0] for r in rows.all()]


async def _interest_label(db: AsyncSession, slug: str) -> str:
    interest = await db.get(Interest, slug)
    if interest is None or not interest.is_active:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Validation failed",
            detail=f"Unknown interest: {slug}",
            errors=[{"field": "interest_id", "message": f"Unknown interest: {slug}"}],
        )
    return interest.display_name


async def _course(db: AsyncSession, course_slug: str) -> Course:
    course = await db.get(Course, course_slug)
    if course is None or not course.is_active:
        raise AppError(status_code=404, code="not_found", title="Unknown course")
    return course


async def _resolve_interest(db: AsyncSession, user: User, override: str | None) -> tuple[str, str]:
    """Returns (slug, display_name)."""
    if override is not None:
        label = await _interest_label(db, override)
        return override, label
    slugs = await _user_interest_slugs(db, user.id)
    if not slugs:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="No interests selected",
            detail="Pick at least one interest before rolling a task.",
            errors=[{"field": "interest_id", "message": "Pick at least one interest first"}],
        )
    chosen = random.choice(slugs)
    label = await _interest_label(db, chosen)
    return chosen, label


async def _find_unused_passage(
    db: AsyncSession, *, user_id: uuid.UUID, interest_slug: str, grade_level: int
) -> ContentPassage | None:
    used_subq = select(Task.content_passage_id).where(
        Task.user_id == user_id,
        Task.content_passage_id.is_not(None),
    )
    stmt = (
        select(ContentPassage)
        .where(
            ContentPassage.interest_slug == interest_slug,
            ContentPassage.grade_level == grade_level,
            ContentPassage.id.not_in(used_subq),
        )
        .order_by(ContentPassage.created_at.asc())
    )
    passages = (await db.execute(stmt)).scalars().all()
    for passage in passages:
        if len(passage.questions) == READING_QUESTION_COUNT:
            return passage
    return None


async def _find_unused_writing_prompt(
    db: AsyncSession, *, user_id: uuid.UUID, interest_slug: str, grade_level: int
) -> WritingPrompt | None:
    used_subq = select(Task.writing_prompt_id).where(
        Task.user_id == user_id,
        Task.writing_prompt_id.is_not(None),
    )
    stmt = (
        select(WritingPrompt)
        .where(
            WritingPrompt.interest_slug == interest_slug,
            WritingPrompt.grade_level == grade_level,
            WritingPrompt.id.not_in(used_subq),
        )
        .order_by(WritingPrompt.created_at.asc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _materialise_reading_questions(
    db: AsyncSession, *, task: Task, passage: ContentPassage
) -> list[TaskQuestion]:
    questions: list[TaskQuestion] = []
    for i, q in enumerate(passage.questions, start=1):
        question = TaskQuestion(
            task_id=task.id,
            position=i,
            question_type=q["question_type"],
            prompt=q["prompt"],
            options=q.get("options"),
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation"),
            max_points=q.get("max_points", 1),
        )
        db.add(question)
        questions.append(question)
    await db.flush()
    return questions


# ---------- roll ----------


async def _find_same_course_blocker(db: AsyncSession, *, user_id: uuid.UUID, course_type: str) -> Task | None:
    for task_status in ROLL_BLOCKER_PRIORITY:
        stmt = (
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.course_type == course_type,
                Task.status == task_status,
            )
            .order_by(Task.updated_at.desc())
            .limit(1)
        )
        task = (await db.execute(stmt)).scalar_one_or_none()
        if task is not None:
            return task
    return None


async def _find_ready_next_task(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    course_type: str,
    exclude_task_id: uuid.UUID | None = None,
) -> Task | None:
    stmt = select(Task).where(
        Task.user_id == user_id,
        Task.course_type == course_type,
        Task.status == "not_started",
    )
    if exclude_task_id is not None:
        stmt = stmt.where(Task.id != exclude_task_id)
    stmt = stmt.order_by(Task.created_at.asc()).limit(1)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _create_new_task(
    db: AsyncSession,
    *,
    user: User,
    course: Course,
    override_interest: str | None = None,
) -> Task:
    interest_slug, interest_label = await _resolve_interest(db, user, override_interest)
    content_grade_level = content_service.content_grade_for_english_level(user.english_level)
    content_level_label = content_service.content_label_for_english_level_value(user.english_level)

    if course.type == "unseen_text":
        passage = await _find_unused_passage(
            db,
            user_id=user.id,
            interest_slug=interest_slug,
            grade_level=content_grade_level,
        )
        usage_event = None
        if passage is None:
            try:
                passage, usage_event = await content_service.generate_reading_passage(
                    db,
                    interest_slug=interest_slug,
                    interest_label=interest_label,
                    school_grade_level=user.grade_level,
                    content_grade_level=content_grade_level,
                    content_level_label=content_level_label,
                    user_id=user.id,
                )
            except Exception as exc:
                LOGGER.exception("reading content generation failed")
                raise AppError(
                    status_code=503,
                    code="unavailable",
                    title="Content generation failed",
                    detail="Couldn't generate a passage right now. Try again shortly.",
                ) from exc
        task = Task(
            user_id=user.id,
            course_slug=course.slug,
            course_type=course.type,
            interest_slug=interest_slug,
            grade_level_at_roll=user.grade_level,
            english_level_at_roll=user.english_level,
            status="not_started",
            title=passage.title,
            topic_label=interest_label,
            content_passage_id=passage.id,
        )
        db.add(task)
        await db.flush()
        if usage_event is not None:
            usage_event.task_id = task.id
        await _materialise_reading_questions(db, task=task, passage=passage)
        await db.commit()
        await db.refresh(task)
        return task

    prompt = await _find_unused_writing_prompt(
        db,
        user_id=user.id,
        interest_slug=interest_slug,
        grade_level=content_grade_level,
    )
    usage_event = None
    if prompt is None:
        try:
            prompt, usage_event = await content_service.generate_writing_prompt(
                db,
                interest_slug=interest_slug,
                interest_label=interest_label,
                school_grade_level=user.grade_level,
                content_grade_level=content_grade_level,
                content_level_label=content_level_label,
                user_id=user.id,
            )
        except Exception as exc:
            LOGGER.exception("writing prompt generation failed")
            raise AppError(
                status_code=503,
                code="unavailable",
                title="Content generation failed",
                detail="Couldn't generate a writing prompt right now. Try again shortly.",
            ) from exc
    task = Task(
        user_id=user.id,
        course_slug=course.slug,
        course_type=course.type,
        interest_slug=interest_slug,
        grade_level_at_roll=user.grade_level,
        english_level_at_roll=user.english_level,
        status="not_started",
        title=prompt.title,
        topic_label=interest_label,
        writing_prompt_id=prompt.id,
    )
    db.add(task)
    await db.flush()
    if usage_event is not None:
        usage_event.task_id = task.id
    await db.commit()
    await db.refresh(task)
    return task


async def ensure_next_task_ready(
    db: AsyncSession, *, user_id: uuid.UUID, course_slug: str, exclude_task_id: uuid.UUID
) -> Task:
    return await ensure_ready_task_for_course(
        db,
        user_id=user_id,
        course_slug=course_slug,
        exclude_task_id=exclude_task_id,
    )


async def ensure_ready_task_for_course(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    course_slug: str,
    exclude_task_id: uuid.UUID | None = None,
) -> Task:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(status_code=404, code="not_found", title="User not found")
    course = await _course(db, course_slug)
    existing = await _find_ready_next_task(
        db,
        user_id=user.id,
        course_type=course.type,
        exclude_task_id=exclude_task_id,
    )
    if existing is not None:
        return existing
    return await _create_new_task(db, user=user, course=course)


def task_to_ready_summary(task: Task) -> ReadyTaskSummary:
    course_id: str = "reading" if task.course_slug == "reading" else "writing"
    return ReadyTaskSummary(
        id=task.id,
        course_id=course_id,  # type: ignore[arg-type]
        course_type=task.course_type,  # type: ignore[arg-type]
        status="not_started",
        title=task.title,
        topic_label=task.topic_label,
    )


async def ready_task_summary_for_course(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    course_slug: str,
    exclude_task_id: uuid.UUID | None = None,
) -> ReadyTaskSummary | None:
    course = await _course(db, course_slug)
    task = await _find_ready_next_task(
        db,
        user_id=user_id,
        course_type=course.type,
        exclude_task_id=exclude_task_id,
    )
    return task_to_ready_summary(task) if task is not None else None


async def ready_task_summaries(
    db: AsyncSession, *, user_id: uuid.UUID
) -> dict[TaskPrewarmCourseId, ReadyTaskSummary | None]:
    return {
        course_slug: await ready_task_summary_for_course(
            db,
            user_id=user_id,
            course_slug=course_slug,
        )
        for course_slug in COURSE_SLUGS
    }


async def enqueue_ready_task_refill(user_id: uuid.UUID, course_slug: str) -> None:
    if course_slug not in COURSE_SLUGS:
        LOGGER.warning("unknown course_slug for task prewarm: %s", course_slug)
        return
    try:
        await enqueue_task_prewarm(user_id, course_slug)  # type: ignore[arg-type]
    except TaskPrewarmQueueError:
        LOGGER.exception("task prewarm enqueue failed")


async def enqueue_all_ready_task_refills(user_id: uuid.UUID) -> None:
    for course_slug in COURSE_SLUGS:
        await enqueue_ready_task_refill(user_id, course_slug)


async def enqueue_missing_ready_task_refills(
    user_id: uuid.UUID,
    summaries: dict[TaskPrewarmCourseId, ReadyTaskSummary | None],
) -> None:
    for course_slug, summary in summaries.items():
        if summary is None:
            await enqueue_ready_task_refill(user_id, course_slug)


async def roll_task(
    db: AsyncSession,
    *,
    user: User,
    course_slug: str,
    override_interest: str | None,
) -> Task:
    """Resume same-course work first, otherwise create a ready task."""
    course = await _course(db, course_slug)
    blocker = await _find_same_course_blocker(db, user_id=user.id, course_type=course.type)
    if blocker is not None:
        return blocker
    return await _create_new_task(
        db,
        user=user,
        course=course,
        override_interest=override_interest,
    )


# ---------- read helpers ----------


async def _load_questions(db: AsyncSession, task_id: uuid.UUID) -> list[TaskQuestion]:
    rows = await db.execute(select(TaskQuestion).where(TaskQuestion.task_id == task_id).order_by(TaskQuestion.position))
    return list(rows.scalars().all())


async def _load_writing_prompt(db: AsyncSession, task: Task) -> WritingPrompt | None:
    if task.writing_prompt_id is None:
        return None
    return await db.get(WritingPrompt, task.writing_prompt_id)


def _question_to_out(q: TaskQuestion, *, reveal: bool) -> TaskQuestionOut:
    return TaskQuestionOut(
        id=q.id,
        position=q.position,
        question_type=q.question_type,  # type: ignore[arg-type]
        prompt=q.prompt,
        options=q.options,
        correct_answer=q.correct_answer if reveal else None,
        explanation=q.explanation if reveal else None,
        max_points=q.max_points,
    )


def _passed(score: float | None) -> bool | None:
    if score is None:
        return None
    return float(score) >= PASSING_SCORE


async def task_to_out(db: AsyncSession, task: Task) -> TaskOut:
    course_id: str = "reading" if task.course_slug == "reading" else "writing"
    reading_payload: ReadingPayloadOut | None = None
    writing_payload: WritingPayloadOut | None = None

    reveal_correct = task.status in ("completed", "needs_retry")

    if task.course_type == "unseen_text":
        questions = await _load_questions(db, task.id)
        passage = await db.get(ContentPassage, task.content_passage_id) if task.content_passage_id else None
        if passage is not None:
            paragraphs = passage.paragraphs
            word_count = passage.word_count
        else:
            paragraphs = []
            word_count = 0
        reading_payload = ReadingPayloadOut(
            title=task.title,
            passage_text="\n\n".join(paragraphs),
            passage_paragraphs=paragraphs,
            passage_word_count=word_count,
            questions=[_question_to_out(q, reveal=reveal_correct) for q in questions],
        )
    elif task.course_type == "short_writing":
        prompt = await _load_writing_prompt(db, task)
        if prompt is not None:
            writing_payload = WritingPayloadOut(
                title=task.title,
                prompt=prompt.prompt,
                hints=prompt.hints,
                min_words=prompt.min_words,
                max_words=prompt.max_words,
                draft=task.writing_draft,
            )

    return TaskOut(
        id=task.id,
        user_id=task.user_id,
        course_id=course_id,  # type: ignore[arg-type]
        course_type=task.course_type,  # type: ignore[arg-type]
        interest_id=task.interest_slug,
        grade_level_at_roll=task.grade_level_at_roll,
        english_level_at_roll=task.english_level_at_roll,
        status=task.status,  # type: ignore[arg-type]
        title=task.title,
        topic_label=task.topic_label,
        reading=reading_payload,
        writing=writing_payload,
        score=float(task.score) if task.score is not None else None,
        xp_awarded=task.xp_awarded,
        started_at=task.started_at,
        submitted_at=task.submitted_at,
        completed_at=task.completed_at,
        failed_at=task.failed_at,
        fail_reason=task.fail_reason,
        passed=_passed(float(task.score) if task.score is not None else None),
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def get_owned_task(db: AsyncSession, *, user_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    task = await db.get(Task, task_id)
    if task is None or task.user_id != user_id:
        raise AppError(status_code=404, code="not_found", title="Task not found")
    return task


# ---------- list ----------


async def list_tasks(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    status: str | None = None,
    course_type: str | None = None,
    limit: int = 20,
) -> list[Task]:
    stmt = select(Task).where(Task.user_id == user_id)
    if status is not None:
        stmt = stmt.where(Task.status == status)
    if course_type is not None:
        stmt = stmt.where(Task.course_type == course_type)
    stmt = stmt.order_by(Task.updated_at.desc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


# ---------- start / answer / submit ----------


async def start_task(db: AsyncSession, task: Task) -> Task:
    was_ready = task.status == "not_started"
    if task.status == "not_started":
        task.status = "in_progress"
        task.started_at = utcnow()
        await db.commit()
        await db.refresh(task)
    if was_ready:
        await enqueue_ready_task_refill(task.user_id, task.course_slug)
    return task


async def record_answer(db: AsyncSession, *, task: Task, question_id: uuid.UUID, answer: str | int) -> None:
    if task.course_type != "unseen_text":
        raise AppError(
            status_code=400,
            code="invalid_state",
            title="Answer endpoint only valid for reading tasks",
        )
    question = await db.get(TaskQuestion, question_id)
    if question is None or question.task_id != task.id:
        raise AppError(status_code=404, code="not_found", title="Question not found")

    was_ready = task.status == "not_started"
    if was_ready:
        task.status = "in_progress"
        task.started_at = utcnow()

    existing_q = await db.execute(
        select(TaskAnswer).where(TaskAnswer.task_id == task.id, TaskAnswer.question_id == question_id)
    )
    record = existing_q.scalar_one_or_none()
    answer_text = str(answer)
    if record is None:
        db.add(TaskAnswer(task_id=task.id, question_id=question_id, answer_text=answer_text))
    else:
        record.answer_text = answer_text
        record.submitted_at = utcnow()
    await db.commit()
    if was_ready:
        await enqueue_ready_task_refill(task.user_id, task.course_slug)


async def submit_reading(
    db: AsyncSession,
    *,
    task: Task,
    answers: dict[uuid.UUID, str | int],
) -> tuple[int, int]:
    if task.course_type != "unseen_text":
        raise AppError(status_code=400, code="invalid_state", title="Not a reading task")
    if task.status not in ("not_started", "in_progress"):
        raise AppError(
            status_code=400,
            code="invalid_state",
            title=f"Task is already {task.status}",
        )

    was_ready = task.status == "not_started"
    questions = await _load_questions(db, task.id)
    total = len(questions)
    correct_count = 0

    for q in questions:
        merged_answer = answers.get(q.id)
        if merged_answer is None:
            stored = await db.execute(
                select(TaskAnswer).where(TaskAnswer.task_id == task.id, TaskAnswer.question_id == q.id)
            )
            ta = stored.scalar_one_or_none()
            if ta is not None and ta.answer_text is not None:
                merged_answer = ta.answer_text
        is_right = is_correct_answer(
            question_type=q.question_type,
            correct_answer=q.correct_answer,
            user_answer=merged_answer,
            options=q.options,
        )
        if is_right:
            correct_count += 1

        existing_row = await db.execute(
            select(TaskAnswer).where(TaskAnswer.task_id == task.id, TaskAnswer.question_id == q.id)
        )
        record = existing_row.scalar_one_or_none()
        answer_text = str(merged_answer) if merged_answer is not None else None
        if record is None:
            db.add(
                TaskAnswer(
                    task_id=task.id,
                    question_id=q.id,
                    answer_text=answer_text,
                    is_correct=is_right,
                    points_awarded=q.max_points if is_right else 0,
                )
            )
        else:
            record.answer_text = answer_text
            record.is_correct = is_right
            record.points_awarded = q.max_points if is_right else 0
            record.submitted_at = utcnow()

    percentage = round((correct_count / total) * 100) if total else 0
    passed = percentage >= PASSING_SCORE
    task.score = float(percentage)
    task.status = "completed" if passed else "needs_retry"
    now = utcnow()
    task.submitted_at = now
    task.completed_at = now
    task.xp_awarded = reading_xp(correct_count, total) if passed else 0

    await db.commit()
    await db.refresh(task)
    if was_ready:
        await enqueue_ready_task_refill(task.user_id, task.course_slug)
    if passed:
        await ensure_next_task_ready(
            db,
            user_id=task.user_id,
            course_slug=task.course_slug,
            exclude_task_id=task.id,
        )
    return correct_count, total


async def save_writing_draft(db: AsyncSession, *, task: Task, text: str) -> datetime:
    if task.course_type != "short_writing":
        raise AppError(status_code=400, code="invalid_state", title="Drafts only apply to writing tasks")
    if task.status not in ("not_started", "in_progress"):
        raise AppError(
            status_code=400,
            code="invalid_state",
            title="Drafts can only be saved before submission",
        )
    task.writing_draft = text
    was_ready = task.status == "not_started"
    if was_ready:
        task.status = "in_progress"
        task.started_at = utcnow()
    await db.commit()
    await db.refresh(task)
    if was_ready:
        await enqueue_ready_task_refill(task.user_id, task.course_slug)
    return task.updated_at


async def submit_writing(db: AsyncSession, *, task: Task, full_text: str) -> Task:
    if task.course_type != "short_writing":
        raise AppError(status_code=400, code="invalid_state", title="Submit-text only applies to writing tasks")
    if task.status not in ("not_started", "in_progress"):
        raise AppError(status_code=400, code="invalid_state", title=f"Task is already {task.status}")

    was_ready = task.status == "not_started"

    # Persist single full-text answer row (question_id NULL).
    existing_full = await db.execute(
        select(TaskAnswer).where(TaskAnswer.task_id == task.id, TaskAnswer.question_id.is_(None))
    )
    record = existing_full.scalar_one_or_none()
    if record is None:
        db.add(TaskAnswer(task_id=task.id, question_id=None, answer_text=full_text))
    else:
        record.answer_text = full_text
        record.submitted_at = utcnow()

    task.writing_draft = full_text
    task.status = "processing"
    task.submitted_at = utcnow()
    await db.commit()
    await db.refresh(task)
    if was_ready:
        await enqueue_ready_task_refill(task.user_id, task.course_slug)
    return task


async def retry_writing(db: AsyncSession, *, task: Task) -> Task:
    if task.course_type != "short_writing":
        raise AppError(status_code=400, code="invalid_state", title="Retry only applies to writing tasks")
    if task.status != "failed":
        raise AppError(status_code=400, code="invalid_state", title="Only failed tasks can be retried")
    task.status = "processing"
    task.failed_at = None
    task.fail_reason = None
    await db.commit()
    await db.refresh(task)
    return task


async def redo_task(db: AsyncSession, *, task: Task) -> Task:
    if task.status != "needs_retry":
        raise AppError(
            status_code=400,
            code="invalid_state",
            title="Only tasks that need retry can be redone",
        )

    if task.course_type == "unseen_text":
        await db.execute(delete(TaskAnswer).where(TaskAnswer.task_id == task.id))
        task.status = "not_started"
        task.score = None
        task.xp_awarded = 0
        task.started_at = None
        task.submitted_at = None
        task.completed_at = None
        task.failed_at = None
        task.fail_reason = None
        await db.commit()
        await db.refresh(task)
        return task

    if task.course_type == "short_writing":
        answer_row_q = await db.execute(
            select(TaskAnswer).where(
                TaskAnswer.task_id == task.id,
                TaskAnswer.question_id.is_(None),
            )
        )
        answer_row = answer_row_q.scalar_one_or_none()
        task.writing_draft = (answer_row.answer_text if answer_row is not None else None) or task.writing_draft or ""
        await db.execute(delete(TaskEvaluation).where(TaskEvaluation.task_id == task.id))
        task.status = "in_progress"
        task.score = None
        task.xp_awarded = 0
        task.started_at = utcnow()
        task.submitted_at = None
        task.completed_at = None
        task.failed_at = None
        task.fail_reason = None
        await db.commit()
        await db.refresh(task)
        return task

    raise AppError(status_code=400, code="invalid_state", title="Unknown task type")


async def mark_writing_evaluation_failed(db: AsyncSession, *, task: Task, reason: str) -> Task:
    if task.course_type != "short_writing":
        raise AppError(
            status_code=400,
            code="invalid_state",
            title="Only writing tasks can fail evaluation",
        )
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
    await db.refresh(task)
    return task


# ---------- result ----------


async def reading_result(db: AsyncSession, task: Task) -> ReadingResultOut:
    questions = await _load_questions(db, task.id)
    answers_rows = await db.execute(select(TaskAnswer).where(TaskAnswer.task_id == task.id))
    answers_by_qid: dict[uuid.UUID, TaskAnswer] = {
        row.question_id: row for row in answers_rows.scalars().all() if row.question_id is not None
    }
    out_questions: list[ReadingResultQuestion] = []
    correct_count = 0
    for q in questions:
        ta = answers_by_qid.get(q.id)
        user_answer: str | int | None = ta.answer_text if ta is not None else None
        is_right = bool(ta.is_correct) if ta is not None else False
        if is_right:
            correct_count += 1
        out_questions.append(
            ReadingResultQuestion(
                id=q.id,
                position=q.position,
                question_type=q.question_type,  # type: ignore[arg-type]
                prompt=q.prompt,
                options=q.options,
                correct_answer=q.correct_answer,
                explanation=q.explanation,
                max_points=q.max_points,
                user_answer=user_answer,
                is_correct=is_right,
            )
        )
    total = len(questions)
    percentage = round((correct_count / total) * 100) if total else 0
    duration = 0
    if task.completed_at and task.started_at:
        duration = int((task.completed_at - task.started_at).total_seconds())
    return ReadingResultOut(
        task_id=task.id,
        score=correct_count,
        total=total,
        percentage=percentage,
        duration_seconds=duration,
        xp_earned=task.xp_awarded,
        passed=percentage >= PASSING_SCORE,
        next_task=await ready_task_summary_for_course(
            db,
            user_id=task.user_id,
            course_slug=task.course_slug,
            exclude_task_id=task.id,
        )
        if percentage >= PASSING_SCORE
        else None,
        questions=out_questions,
    )


async def writing_result(db: AsyncSession, task: Task) -> WritingResultOut:
    eval_row_q = await db.execute(select(TaskEvaluation).where(TaskEvaluation.task_id == task.id))
    eval_row = eval_row_q.scalar_one_or_none()
    answer_row_q = await db.execute(
        select(TaskAnswer).where(TaskAnswer.task_id == task.id, TaskAnswer.question_id.is_(None))
    )
    answer_row = answer_row_q.scalar_one_or_none()
    answer_text = (answer_row.answer_text if answer_row is not None else None) or task.writing_draft or ""
    evaluation: WritingEvaluationOut | None = None
    if eval_row is not None:
        evaluation = WritingEvaluationOut.model_validate(
            {
                "score_overall": float(eval_row.score_overall),
                "score_grammar": float(eval_row.score_grammar),
                "score_vocabulary": float(eval_row.score_vocabulary),
                "score_structure": float(eval_row.score_structure),
                "score_relevance": float(eval_row.score_relevance),
                "feedback_summary": eval_row.feedback_summary,
                "feedback_detail": eval_row.feedback_detail,
                "focus_next": eval_row.focus_next,
                "highlights": eval_row.highlights,
            }
        )
    passed = _passed(float(task.score) if task.score is not None else None)
    return WritingResultOut(
        task_id=task.id,
        status=task.status,  # type: ignore[arg-type]
        answer_text=answer_text,
        evaluation=evaluation,
        fail_reason=task.fail_reason,
        xp_earned=task.xp_awarded,
        passed=passed,
        next_task=await ready_task_summary_for_course(
            db,
            user_id=task.user_id,
            course_slug=task.course_slug,
            exclude_task_id=task.id,
        )
        if passed
        else None,
        submitted_at=task.submitted_at,
        completed_at=task.completed_at,
    )
