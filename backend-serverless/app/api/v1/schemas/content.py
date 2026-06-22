"""Internal schemas for validating LLM-generated content."""

from __future__ import annotations

from typing import Literal, Self

from pydantic import Field, field_validator, model_validator

from app.api.v1.schemas.common import ApiModel

QuestionType = Literal["multiple_choice", "true_false", "fill_blank"]
READING_QUESTION_COUNT = 10


class GeneratedQuestion(ApiModel):
    question_type: QuestionType
    prompt: str = Field(min_length=1)
    options: list[str] | None = None
    correct_answer: str = Field(min_length=1)
    explanation: str | None = None
    max_points: Literal[1] = 1

    @field_validator("options")
    @classmethod
    def _options_for_type(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        if not all(isinstance(item, str) and item for item in v):
            msg = "All options must be non-empty strings"
            raise ValueError(msg)
        return v

    @model_validator(mode="after")
    def _validate_question_shape(self) -> Self:
        if self.question_type == "multiple_choice":
            if self.options is None or len(self.options) != 4:
                msg = "multiple_choice questions must have exactly 4 options"
                raise ValueError(msg)
            if self.correct_answer not in self.options:
                msg = "multiple_choice correct_answer must match an option"
                raise ValueError(msg)
        elif self.question_type == "true_false":
            if self.options != ["True", "False"]:
                msg = 'true_false options must be exactly ["True", "False"]'
                raise ValueError(msg)
            if self.correct_answer not in {"True", "False"}:
                msg = 'true_false correct_answer must be "True" or "False"'
                raise ValueError(msg)
        elif self.question_type == "fill_blank":
            if self.options is not None:
                msg = "fill_blank options must be null"
                raise ValueError(msg)
            if self.correct_answer != self.correct_answer.strip().lower():
                msg = "fill_blank correct_answer must be lowercase and trimmed"
                raise ValueError(msg)
        return self


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
