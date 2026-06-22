"""Generate + cache reading passages and writing prompts via LLM."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.content import (
    READING_QUESTION_COUNT,
    GeneratedReadingPassage,
    GeneratedWritingEvaluation,
    GeneratedWritingPrompt,
)
from app.db.models.content import ContentPassage, WritingPrompt
from app.db.models.llm_usage import LLMUsageEvent
from app.llm.client import LLMClient, LLMRunMetadata, get_llm_client, render_prompt
from app.services import llm_usage_service
from app.services.level_service import (
    content_bucket_for_english_level,
    content_label_for_english_level,
)

LOGGER = logging.getLogger(__name__)


def _word_count(paragraphs: list[str]) -> int:
    return sum(len(p.split()) for p in paragraphs)


def content_grade_for_school_grade(grade_level: int) -> int:
    """Map Israeli school grade to English content difficulty."""
    return max(1, min(12, grade_level) - 1)


def content_grade_for_english_level(english_level: int) -> int:
    return content_bucket_for_english_level(english_level)


def content_label_for_english_level_value(english_level: int) -> str:
    return content_label_for_english_level(english_level)


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


def writing_submission_word_count(text: str) -> int:
    """Match the client word counter: trim, then split on whitespace."""
    stripped = text.strip()
    return len(stripped.split()) if stripped else 0


async def generate_reading_passage(
    db: AsyncSession,
    *,
    interest_slug: str,
    interest_label: str,
    school_grade_level: int,
    content_grade_level: int,
    content_level_label: str,
    user_id: uuid.UUID | None = None,
    client: LLMClient | None = None,
) -> tuple[ContentPassage, LLMUsageEvent]:
    """Call the LLM, validate, persist content, and record usage."""
    cli = client or get_llm_client()
    prompt = render_prompt(
        "reading_passage",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        content_level_label=content_level_label,
        interest_label=interest_label,
        target_words=_reading_target_words(content_grade_level),
        target_paragraphs=_reading_paragraphs_target(content_grade_level),
        num_questions=_reading_num_questions(content_grade_level),
    )
    parsed, metadata = await cli.generate_structured(
        prompt=prompt,
        output_type=GeneratedReadingPassage,
    )
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
    usage_event = await llm_usage_service.record_llm_usage(
        db,
        operation="reading_passage_generation",
        model_label=cli.model,
        metadata=metadata,
        user_id=user_id,
        resource_type="content_passage",
        resource_id=passage.id,
    )
    return passage, usage_event


async def generate_writing_prompt(
    db: AsyncSession,
    *,
    interest_slug: str,
    interest_label: str,
    school_grade_level: int,
    content_grade_level: int,
    content_level_label: str,
    user_id: uuid.UUID | None = None,
    client: LLMClient | None = None,
) -> tuple[WritingPrompt, LLMUsageEvent]:
    cli = client or get_llm_client()
    min_w, max_w = writing_word_bounds(content_grade_level)
    prompt = render_prompt(
        "writing_prompt",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        content_level_label=content_level_label,
        interest_label=interest_label,
        min_words=min_w,
        max_words=max_w,
    )
    parsed, metadata = await cli.generate_structured(
        prompt=prompt,
        output_type=GeneratedWritingPrompt,
    )
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
    usage_event = await llm_usage_service.record_llm_usage(
        db,
        operation="writing_prompt_generation",
        model_label=cli.model,
        metadata=metadata,
        user_id=user_id,
        resource_type="writing_prompt",
        resource_id=record.id,
    )
    return record, usage_event


async def evaluate_writing(
    *,
    school_grade_level: int,
    content_grade_level: int,
    content_level_label: str,
    topic_label: str,
    prompt_text: str,
    min_words: int,
    max_words: int,
    submitted_word_count: int,
    student_answer: str,
    client: LLMClient | None = None,
) -> tuple[GeneratedWritingEvaluation, LLMRunMetadata, str]:
    """Call the LLM to score a student writing answer."""
    cli = client or get_llm_client()
    prompt = render_prompt(
        "writing_evaluation",
        school_grade_level=school_grade_level,
        content_grade_level=content_grade_level,
        content_level_label=content_level_label,
        topic_label=topic_label,
        prompt=prompt_text,
        min_words=min_words,
        max_words=max_words,
        submitted_word_count=submitted_word_count,
        student_answer=student_answer,
    )
    evaluation, metadata = await cli.generate_structured(
        prompt=prompt,
        output_type=GeneratedWritingEvaluation,
    )
    return evaluation, metadata, cli.model
