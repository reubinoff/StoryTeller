"""Catalog DTOs (interest + course)."""

from __future__ import annotations

from typing import Literal

from app.api.v1.schemas.common import ApiModel

CourseType = Literal["unseen_text", "short_writing"]


class InterestOut(ApiModel):
    id: str
    display_name: str
    emoji: str
    display_order: int


class CourseOut(ApiModel):
    id: str
    slug: str
    type: CourseType
    title: str
    subtitle: str
    description: str
    min_grade: int
    max_grade: int
    estimated_minutes: int
    illustration: Literal["reading", "writing"]
