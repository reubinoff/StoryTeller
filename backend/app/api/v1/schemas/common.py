"""Shared Pydantic types and base config."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        str_strip_whitespace=True,
    )


class Page(ApiModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
