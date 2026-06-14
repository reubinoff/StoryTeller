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
    onboarding_completed: bool


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


class CompleteOnboardingRequest(ApiModel):
    year_of_birth: int
    grade_level: int = Field(ge=1, le=12)
    interest_ids: list[str] = Field(min_length=1, max_length=6)

    @field_validator("year_of_birth")
    @classmethod
    def _year_range(cls, v: int) -> int:
        current = datetime.now().year
        if v < current - 100 or v > current - 5:
            msg = f"Must be between {current - 100} and {current - 5}."
            raise ValueError(msg)
        return v

    @field_validator("interest_ids")
    @classmethod
    def _unique_interests(cls, v: list[str]) -> list[str]:
        seen: list[str] = []
        for slug in v:
            if slug not in seen:
                seen.append(slug)
        return seen


class DeleteAccountRequest(ApiModel):
    confirm: bool
