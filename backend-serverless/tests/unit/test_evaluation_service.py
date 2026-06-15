"""Unit coverage for writing evaluation worker branches."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.content import WritingPrompt
from app.db.models.interest import UserInterest
from app.db.models.notification import Notification
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_evaluation import TaskEvaluation
from app.db.models.user import User
from app.services.content_service import content_grade_for_school_grade
from app.services.evaluation_service import run_writing_evaluation

BOTH_SIDES_NOW_ANSWER = (
    '"Both Sides Now" by Joni Mitchell is the song I keep coming back to. '
    "My mom used to play it on Sunday mornings while she made coffee, and back then "
    "I thought it was just pretty and a little sad. I didn't get it. Then somewhere "
    "in my late twenties—after a breakup, a move, a couple of jobs that didn't work "
    "out—the words finally landed. She sings about looking at clouds, at love, at life "
    "from both sides and admitting she still doesn't really know any of it. That used "
    "to feel like defeat to me. Now it feels like the most honest thing anyone's ever "
    "said. The older I get, the less sure I am about almost everything, and this song "
    "tells me that's okay—that it might even be a kind of wisdom. I play it when I need "
    "to feel less alone in not having the answers. It always works."
)


async def _create_writing_task(
    sm: async_sessionmaker[AsyncSession],
    *,
    status: str = "processing",
    with_prompt: bool = True,
    draft: str | None = "Kyoto is amazing because of bamboo and tea.",
    answer_text: str | None = None,
    school_grade: int = 3,
    prompt_text: str = "Write about a place you would love to visit.",
    min_words: int = 10,
    max_words: int = 100,
) -> uuid.UUID:
    content_grade = content_grade_for_school_grade(school_grade)
    async with sm() as db:
        user = User(
            email=f"{uuid.uuid4()}@example.com",
            first_name="Maya",
            last_name="Patel",
            year_of_birth=2017,
            grade_level=school_grade,
        )
        db.add(user)
        await db.flush()
        db.add(UserInterest(user_id=user.id, interest_slug="travel"))

        prompt_id: uuid.UUID | None = None
        if with_prompt:
            prompt = WritingPrompt(
                interest_slug="travel",
                grade_level=content_grade,
                title="A Place You Would Love to Visit",
                prompt=prompt_text,
                hints=[],
                min_words=min_words,
                max_words=max_words,
                model="test",
            )
            spare_prompt = WritingPrompt(
                interest_slug="travel",
                grade_level=content_grade,
                title="Another Place You Would Love to Visit",
                prompt="Write about another place you would love to visit.",
                hints=[],
                min_words=min_words,
                max_words=max_words,
                model="test",
            )
            db.add_all([prompt, spare_prompt])
            await db.flush()
            prompt_id = prompt.id

        task = Task(
            user_id=user.id,
            course_slug="writing",
            course_type="short_writing",
            interest_slug="travel",
            grade_level_at_roll=school_grade,
            status=status,
            title="A Place You Would Love to Visit",
            topic_label="Travel",
            writing_prompt_id=prompt_id,
            writing_draft=draft,
        )
        db.add(task)
        await db.flush()

        if answer_text is not None:
            db.add(
                TaskAnswer(
                    task_id=task.id,
                    question_id=None,
                    answer_text=answer_text,
                )
            )

        await db.commit()
        return task.id


@pytest.mark.asyncio
async def test_worker_skips_writing_task_that_is_not_ready(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(sm, status="not_started")

    await run_writing_evaluation(task_id)

    async with sm() as db:
        task = await db.get(Task, task_id)
        eval_count = await db.scalar(
            select(func.count()).select_from(TaskEvaluation).where(
                TaskEvaluation.task_id == task_id
            )
        )
        notif_count = await db.scalar(
            select(func.count()).select_from(Notification).where(
                Notification.payload["task_id"].as_string() == str(task_id)
            )
        )
    assert task is not None
    assert task.status == "not_started"
    assert eval_count == 0
    assert notif_count == 0
    assert claude_stub.calls == []


@pytest.mark.asyncio
async def test_worker_marks_failed_when_writing_prompt_is_missing(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(sm, with_prompt=False)

    await run_writing_evaluation(task_id)

    async with sm() as db:
        task = await db.get(Task, task_id)
        notification = (
            await db.execute(
                select(Notification).where(
                    Notification.payload["task_id"].as_string() == str(task_id)
                )
            )
        ).scalar_one()
    assert task is not None
    assert task.status == "failed"
    assert task.fail_reason == "Missing writing prompt"
    assert task.failed_at is not None
    assert notification.kind == "task_failed"
    assert notification.payload["reason"] == "Missing writing prompt"
    assert claude_stub.calls == []


@pytest.mark.asyncio
async def test_worker_marks_failed_when_submission_text_is_empty(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(sm, draft="")

    await run_writing_evaluation(task_id)

    async with sm() as db:
        task = await db.get(Task, task_id)
        notification = (
            await db.execute(
                select(Notification).where(
                    Notification.payload["task_id"].as_string() == str(task_id)
                )
            )
        ).scalar_one()
    assert task is not None
    assert task.status == "failed"
    assert task.fail_reason == "No submission text"
    assert notification.kind == "task_failed"
    assert notification.payload["reason"] == "No submission text"
    assert claude_stub.calls == []


@pytest.mark.asyncio
async def test_worker_uses_persisted_answer_when_draft_is_empty(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(
        sm,
        draft="",
        answer_text="Kyoto is amazing because of bamboo and tea.",
    )

    await run_writing_evaluation(task_id)

    async with sm() as db:
        task = await db.get(Task, task_id)
        evaluation = (
            await db.execute(
                select(TaskEvaluation).where(TaskEvaluation.task_id == task_id)
            )
        ).scalar_one()
        notification = (
            await db.execute(
                select(Notification).where(
                    Notification.payload["task_id"].as_string() == str(task_id)
                )
            )
        ).scalar_one()
    assert task is not None
    assert task.status == "completed"
    assert float(task.score) == 84
    assert evaluation.score_overall == 84
    assert evaluation.prompt_version == "v2"
    assert notification.kind == "task_completed"
    assert len(claude_stub.calls) == 1
    prompt = claude_stub.calls[0]["prompt"]
    assert "Israeli school English learner" in prompt
    assert "School grade: **3**" in prompt
    assert "English difficulty grade: **2**" in prompt


@pytest.mark.asyncio
async def test_worker_requests_beginner_level_feedback_for_grade_one(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(
        sm,
        school_grade=1,
        draft="I like cats. Cats are fun.",
    )

    await run_writing_evaluation(task_id)

    assert len(claude_stub.calls) == 1
    prompt = claude_stub.calls[0]["prompt"]
    assert "English difficulty grade: **1**" in prompt
    assert "Write every feedback field in English at difficulty grade 1" in prompt
    assert "Use very short sentences with common words" in prompt


@pytest.mark.asyncio
async def test_worker_prefers_persisted_answer_over_mutable_draft(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(
        sm,
        draft="This later draft should not be evaluated.",
        answer_text="Submitted answer should be evaluated.",
    )

    await run_writing_evaluation(task_id)

    assert len(claude_stub.calls) == 1
    prompt = claude_stub.calls[0]["prompt"]
    assert "Submitted answer should be evaluated." in prompt
    assert "This later draft should not be evaluated." not in prompt


@pytest.mark.asyncio
async def test_worker_supplies_authoritative_word_count_without_maturity_penalty(
    db_engine,
    claude_stub,
) -> None:
    _engine, sm = db_engine
    task_id = await _create_writing_task(
        sm,
        school_grade=7,
        draft=BOTH_SIDES_NOW_ANSWER,
        prompt_text=(
            "Write about a song that is special to you. In 80-180 words, describe "
            "the song and explain why it means so much to you."
        ),
        min_words=80,
        max_words=180,
    )

    await run_writing_evaluation(task_id)

    assert len(claude_stub.calls) == 1
    prompt = claude_stub.calls[0]["prompt"]
    assert "School grade: **7**" in prompt
    assert "English difficulty grade: **6**" in prompt
    assert "Submitted word count: **152**" in prompt
    assert "Required range: **80-180 words**" in prompt
    assert "Word-count status: **within range**" in prompt
    assert (
        "Do not penalize an answer because the writer's voice, vocabulary, memories, "
        "life experience, or reflection seems too mature or too young"
    ) in prompt
    assert "topic maturity" not in prompt
