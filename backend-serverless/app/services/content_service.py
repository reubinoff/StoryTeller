"""Generate + cache reading passages and writing prompts via Claude."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.content import (
    GeneratedReadingPassage,
    GeneratedWritingEvaluation,
    GeneratedWritingPrompt,
    READING_QUESTION_COUNT,
)
from app.db.models.content import ContentPassage, WritingPrompt
from app.llm.claude_client import ClaudeClient, get_claude_client, render_prompt

LOGGER = logging.getLogger(__name__)


def _word_count(paragraphs: list[str]) -> int:
    return sum(len(p.split()) for p in paragraphs)


def content_grade_for_school_grade(grade_level: int) -> int:
    """Map Israeli school grade to English content difficulty."""
    return max(1, min(12, grade_level) - 1)


def _reading_target_words(grade_level: int) -> int:
    """Per PRD: passage length scales with grade. Grade 1 ~120, Grade 12 ~400."""
    return max(80, min(420, 100 + grade_level * 25))


def _reading_paragraphs_target(grade_level: int) -> int:
    if grade_level <= 4:
        return 3
    if grade_level <= 8:
        return 4
    return 5


def _reading_num_questions(_grade_level: int) -> int:
    return READING_QUESTION_COUNT


def writing_word_bounds(grade_level: int) -> tuple[int, int]:
    """Per PRD §6.2: scale with grade."""
    if grade_level <= 2:
        return 30, 80
    if grade_level <= 5:
        return 50, 110
    if grade_level <= 8:
        return 80, 180
    return 150, 320


async def generate_reading_passage(
    db: AsyncSession,
    *,
    interest_slug: str,
    interest_label: str,
    school_grade_level: int,
    content_grade_level: int,
    client: ClaudeClient | None = None,
) -> ContentPassage:
    """Call Claude, validate, persist a new ContentPassage row. Returns it."""
    cli = client or get_claude_client()
    prompt = render_prompt(
        "reading_passage",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        interest_label=interest_label,
        target_words=_reading_target_words(content_grade_level),
        target_paragraphs=_reading_paragraphs_target(content_grade_level),
        num_questions=_reading_num_questions(content_grade_level),
    )
    raw, _latency = await cli.generate_json(prompt=prompt)
    parsed = GeneratedReadingPassage.model_validate(raw)
    passage = ContentPassage(
        interest_slug=interest_slug,
        grade_level=content_grade_level,
        title=parsed.title,
        paragraphs=parsed.paragraphs,
        questions=[q.model_dump() for q in parsed.questions],
        word_count=_word_count(parsed.paragraphs),
        model=cli.model,
    )
    db.add(passage)
    await db.flush()
    return passage


async def generate_writing_prompt(
    db: AsyncSession,
    *,
    interest_slug: str,
    interest_label: str,
    school_grade_level: int,
    content_grade_level: int,
    client: ClaudeClient | None = None,
) -> WritingPrompt:
    cli = client or get_claude_client()
    min_w, max_w = writing_word_bounds(content_grade_level)
    prompt = render_prompt(
        "writing_prompt",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        interest_label=interest_label,
        min_words=min_w,
        max_words=max_w,
    )
    raw, _latency = await cli.generate_json(prompt=prompt)
    parsed = GeneratedWritingPrompt.model_validate(raw)
    if parsed.min_words >= parsed.max_words:
        parsed = parsed.model_copy(update={"min_words": min_w, "max_words": max_w})
    record = WritingPrompt(
        interest_slug=interest_slug,
        grade_level=content_grade_level,
        title=parsed.title,
        prompt=parsed.prompt,
        hints=parsed.hints,
        min_words=parsed.min_words,
        max_words=parsed.max_words,
        model=cli.model,
    )
    db.add(record)
    await db.flush()
    return record


async def evaluate_writing(
    *,
    school_grade_level: int,
    content_grade_level: int,
    topic_label: str,
    prompt_text: str,
    student_answer: str,
    client: ClaudeClient | None = None,
) -> tuple[GeneratedWritingEvaluation, int, str]:
    """Call Claude to score a student writing answer. Returns (evaluation, latency_ms, model)."""
    cli = client or get_claude_client()
    prompt = render_prompt(
        "writing_evaluation",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        topic_label=topic_label,
        prompt=prompt_text,
        student_answer=student_answer,
    )
    raw, latency = await cli.generate_json(prompt=prompt)
    return GeneratedWritingEvaluation.model_validate(raw), latency, cli.model
