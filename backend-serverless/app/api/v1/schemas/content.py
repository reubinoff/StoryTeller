"""Internal schemas for validating Claude's generated content."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

from app.api.v1.schemas.common import ApiModel

QuestionType = Literal["multiple_choice", "true_false", "fill_blank"]
READING_QUESTION_COUNT = 10


class GeneratedQuestion(ApiModel):
    question_type: QuestionType
    prompt: str = Field(min_length=1)
    options: list[str] | None = None
    correct_answer: str = Field(min_length=1)
    explanation: str | None = None
    max_points: int = 1

    @field_validator("options")
    @classmethod
    def _options_for_type(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        if not all(isinstance(item, str) and item for item in v):
            msg = "All options must be non-empty strings"
            raise ValueError(msg)
        return v


class GeneratedReadingPassage(ApiModel):
    title: str = Field(min_length=1, max_length=160)
    paragraphs: list[str] = Field(min_length=1)
    questions: list[GeneratedQuestion] = Field(
        min_length=READING_QUESTION_COUNT,
        max_length=READING_QUESTION_COUNT,
    )


class GeneratedWritingPrompt(ApiModel):
    title: str = Field(min_length=1, max_length=160)
    prompt: str = Field(min_length=1)
    hints: list[str] = Field(default_factory=list)
    min_words: int = Field(ge=10, le=2000)
    max_words: int = Field(ge=10, le=2000)


class GeneratedHighlight(ApiModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    kind: Literal["grammar", "word_choice", "suggestion"]
    message: str = Field(min_length=1)


class GeneratedWritingEvaluation(ApiModel):
    score_overall: float = Field(ge=0, le=100)
    score_grammar: float = Field(ge=0, le=100)
    score_vocabulary: float = Field(ge=0, le=100)
    score_structure: float = Field(ge=0, le=100)
    score_relevance: float = Field(ge=0, le=100)
    feedback_summary: str = Field(min_length=1)
    feedback_detail: list[str] = Field(default_factory=list)
    focus_next: list[str] = Field(default_factory=list)
    highlights: list[GeneratedHighlight] = Field(default_factory=list)
