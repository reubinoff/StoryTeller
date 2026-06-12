"""Task lifecycle service: roll, start, answer, submit, draft, retry, result."""

from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.task import (
    ReadingPayloadOut,
    ReadingResultOut,
    ReadingResultQuestion,
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
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_evaluation import TaskEvaluation
from app.db.models.task_question import TaskQuestion
from app.db.models.user import User
from app.services import content_service

LOGGER = logging.getLogger(__name__)


# ---------- helpers ----------


async def _user_interest_slugs(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await db.execute(
        select(UserInterest.interest_slug).where(UserInterest.user_id == user_id)
    )
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


async def _resolve_interest(
    db: AsyncSession, user: User, override: str | None
) -> tuple[str, str]:
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
    used_subq = (
        select(Task.content_passage_id)
        .where(
            Task.user_id == user_id,
            Task.content_passage_id.is_not(None),
        )
    )
    stmt = (
        select(ContentPassage)
        .where(
            ContentPassage.interest_slug == interest_slug,
            ContentPassage.grade_level == grade_level,
            ContentPassage.id.not_in(used_subq),
        )
        .order_by(ContentPassage.created_at.asc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _find_unused_writing_prompt(
    db: AsyncSession, *, user_id: uuid.UUID, interest_slug: str, grade_level: int
) -> WritingPrompt | None:
    used_subq = (
        select(Task.writing_prompt_id)
        .where(
            Task.user_id == user_id,
            Task.writing_prompt_id.is_not(None),
        )
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


async def roll_task(
    db: AsyncSession,
    *,
    user: User,
    course_slug: str,
    override_interest: str | None,
) -> Task:
    """Create a new task, reusing cached content where possible."""
    course = await _course(db, course_slug)
    interest_slug, interest_label = await _resolve_interest(db, user, override_interest)

    if course.type == "unseen_text":
        passage = await _find_unused_passage(
            db,
            user_id=user.id,
            interest_slug=interest_slug,
            grade_level=user.grade_level,
        )
        if passage is None:
            try:
                passage = await content_service.generate_reading_passage(
                    db,
                    interest_slug=interest_slug,
                    interest_label=interest_label,
                    grade_level=user.grade_level,
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
            status="not_started",
            title=passage.title,
            topic_label=interest_label,
            content_passage_id=passage.id,
        )
        db.add(task)
        await db.flush()
        await _materialise_reading_questions(db, task=task, passage=passage)
        await db.commit()
        await db.refresh(task)
        return task

    # short_writing
    prompt = await _find_unused_writing_prompt(
        db,
        user_id=user.id,
        interest_slug=interest_slug,
        grade_level=user.grade_level,
    )
    if prompt is None:
        try:
            prompt = await content_service.generate_writing_prompt(
                db,
                interest_slug=interest_slug,
                interest_label=interest_label,
                grade_level=user.grade_level,
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
        status="not_started",
        title=prompt.title,
        topic_label=interest_label,
        writing_prompt_id=prompt.id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


# ---------- read helpers ----------


async def _load_questions(db: AsyncSession, task_id: uuid.UUID) -> list[TaskQuestion]:
    rows = await db.execute(
        select(TaskQuestion)
        .where(TaskQuestion.task_id == task_id)
        .order_by(TaskQuestion.position)
    )
    return list(rows.scalars().all())


async def _load_writing_prompt(
    db: AsyncSession, task: Task
) -> WritingPrompt | None:
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


async def task_to_out(db: AsyncSession, task: Task) -> TaskOut:
    course_id: str = "reading" if task.course_slug == "reading" else "writing"
    reading_payload: ReadingPayloadOut | None = None
    writing_payload: WritingPayloadOut | None = None

    reveal_correct = task.status == "completed"

    if task.course_type == "unseen_text":
        questions = await _load_questions(db, task.id)
        passage = (
            await db.get(ContentPassage, task.content_passage_id)
            if task.content_passage_id
            else None
        )
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
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def get_owned_task(
    db: AsyncSession, *, user_id: uuid.UUID, task_id: uuid.UUID
) -> Task:
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
    if task.status == "not_started":
        task.status = "in_progress"
        task.started_at = utcnow()
        await db.commit()
        await db.refresh(task)
    return task


async def record_answer(
    db: AsyncSession, *, task: Task, question_id: uuid.UUID, answer: str | int
) -> None:
    if task.course_type != "unseen_text":
        raise AppError(
            status_code=400,
            code="invalid_state",
            title="Answer endpoint only valid for reading tasks",
        )
    question = await db.get(TaskQuestion, question_id)
    if question is None or question.task_id != task.id:
        raise AppError(status_code=404, code="not_found", title="Question not found")

    if task.status == "not_started":
        task.status = "in_progress"
        task.started_at = utcnow()

    existing_q = await db.execute(
        select(TaskAnswer).where(
            TaskAnswer.task_id == task.id, TaskAnswer.question_id == question_id
        )
    )
    record = existing_q.scalar_one_or_none()
    answer_text = str(answer)
    if record is None:
        db.add(TaskAnswer(task_id=task.id, question_id=question_id, answer_text=answer_text))
    else:
        record.answer_text = answer_text
        record.submitted_at = utcnow()
    await db.commit()


async def submit_reading(
    db: AsyncSession,
    *,
    task: Task,
    answers: dict[uuid.UUID, str | int],
) -> tuple[int, int]:
    if task.course_type != "unseen_text":
        raise AppError(
            status_code=400, code="invalid_state", title="Not a reading task"
        )
    if task.status not in ("not_started", "in_progress"):
        raise AppError(
            status_code=400,
            code="invalid_state",
            title=f"Task is already {task.status}",
        )

    questions = await _load_questions(db, task.id)
    total = len(questions)
    correct_count = 0

    for q in questions:
        merged_answer = answers.get(q.id)
        if merged_answer is None:
            stored = await db.execute(
                select(TaskAnswer).where(
                    TaskAnswer.task_id == task.id, TaskAnswer.question_id == q.id
                )
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
            select(TaskAnswer).where(
                TaskAnswer.task_id == task.id, TaskAnswer.question_id == q.id
            )
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
    task.score = float(percentage)
    task.status = "completed"
    now = utcnow()
    task.submitted_at = now
    task.completed_at = now
    task.xp_awarded = reading_xp(correct_count, total)

    await db.commit()
    await db.refresh(task)
    return correct_count, total


async def save_writing_draft(
    db: AsyncSession, *, task: Task, text: str
) -> datetime:
    if task.course_type != "short_writing":
        raise AppError(
            status_code=400, code="invalid_state", title="Drafts only apply to writing tasks"
        )
    task.writing_draft = text
    if task.status == "not_started":
        task.status = "in_progress"
        task.started_at = utcnow()
    await db.commit()
    await db.refresh(task)
    return task.updated_at


async def submit_writing(
    db: AsyncSession, *, task: Task, full_text: str
) -> Task:
    if task.course_type != "short_writing":
        raise AppError(
            status_code=400, code="invalid_state", title="Submit-text only applies to writing tasks"
        )
    if task.status not in ("not_started", "in_progress"):
        raise AppError(
            status_code=400, code="invalid_state", title=f"Task is already {task.status}"
        )

    # Persist single full-text answer row (question_id NULL).
    existing_full = await db.execute(
        select(TaskAnswer).where(
            TaskAnswer.task_id == task.id, TaskAnswer.question_id.is_(None)
        )
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
    return task


async def retry_writing(db: AsyncSession, *, task: Task) -> Task:
    if task.course_type != "short_writing":
        raise AppError(
            status_code=400, code="invalid_state", title="Retry only applies to writing tasks"
        )
    if task.status != "failed":
        raise AppError(
            status_code=400, code="invalid_state", title="Only failed tasks can be retried"
        )
    task.status = "processing"
    task.failed_at = None
    task.fail_reason = None
    await db.commit()
    await db.refresh(task)
    return task


# ---------- result ----------


async def reading_result(db: AsyncSession, task: Task) -> ReadingResultOut:
    questions = await _load_questions(db, task.id)
    answers_rows = await db.execute(
        select(TaskAnswer).where(TaskAnswer.task_id == task.id)
    )
    answers_by_qid: dict[uuid.UUID, TaskAnswer] = {
        row.question_id: row
        for row in answers_rows.scalars().all()
        if row.question_id is not None
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
        questions=out_questions,
    )


async def writing_result(db: AsyncSession, task: Task) -> WritingResultOut:
    eval_row_q = await db.execute(
        select(TaskEvaluation).where(TaskEvaluation.task_id == task.id)
    )
    eval_row = eval_row_q.scalar_one_or_none()
    answer_row_q = await db.execute(
        select(TaskAnswer).where(
            TaskAnswer.task_id == task.id, TaskAnswer.question_id.is_(None)
        )
    )
    answer_row = answer_row_q.scalar_one_or_none()
    answer_text = (
        (answer_row.answer_text if answer_row is not None else None) or task.writing_draft or ""
    )
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
    return WritingResultOut(
        task_id=task.id,
        status=task.status,  # type: ignore[arg-type]
        answer_text=answer_text,
        evaluation=evaluation,
        xp_earned=task.xp_awarded,
        submitted_at=task.submitted_at,
        completed_at=task.completed_at,
    )
