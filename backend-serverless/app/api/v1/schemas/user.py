"""User-facing DTOs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.api.v1.schemas.common import ApiModel

ThemePreference = Literal["auto", "light", "dark"]
TextSizePreference = Literal["sm", "md", "lg"]
UserRole = Literal["user", "admin", "support"]
UserStatus = Literal["active", "suspended", "deleted"]


class UserOut(ApiModel):
    id: UUID
    email: EmailStr
    email_verified: bool
    first_name: str
    last_name: str
    year_of_birth: int
    grade_level: int
    phone_number: str | None
    avatar_url: str | None
    display_locale: str
    theme_preference: ThemePreference
    text_size_preference: TextSizePreference
    reduce_motion: bool
    notif_email_enabled: bool
    notif_inapp_enabled: bool
    interests: list[str]
    role: UserRole
    status: UserStatus
    created_at: datetime


class UpdateUserRequest(ApiModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=40)
    last_name: str | None = Field(default=None, min_length=1, max_length=40)
    phone_number: str | None = Field(default=None, max_length=20)
    theme_preference: ThemePreference | None = None
    text_size_preference: TextSizePreference | None = None
    reduce_motion: bool | None = None
    notif_email_enabled: bool | None = None
    notif_inapp_enabled: bool | None = None


class UpdateInterestsRequest(ApiModel):
    interest_ids: list[str] = Field(min_length=1, max_length=6)

    @field_validator("interest_ids")
    @classmethod
    def _unique(cls, v: list[str]) -> list[str]:
        seen: list[str] = []
        for slug in v:
            if slug not in seen:
                seen.append(slug)
        return seen


class UpdateInterestsResponse(ApiModel):
    interests: list[str]


class DeleteAccountRequest(ApiModel):
    confirm: bool
