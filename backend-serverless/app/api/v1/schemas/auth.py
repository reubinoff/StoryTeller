"""Auth request / response DTOs."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.api.v1.schemas.common import ApiModel
from app.api.v1.schemas.user import UserOut

NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$")


class SignupRequest(ApiModel):
    first_name: str = Field(min_length=1, max_length=40)
    last_name: str = Field(min_length=1, max_length=40)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    year_of_birth: int

    @field_validator("first_name", "last_name")
    @classmethod
    def _name_chars(cls, v: str) -> str:
        if not NAME_RE.match(v):
            msg = "Must contain only letters, spaces, or hyphens."
            raise ValueError(msg)
        return v

    @field_validator("password")
    @classmethod
    def _password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            msg = "Must contain at least one letter and one number."
            raise ValueError(msg)
        return v

    @field_validator("year_of_birth")
    @classmethod
    def _year_range(cls, v: int) -> int:
        current = datetime.now().year
        if v < current - 100 or v > current - 5:
            msg = f"Must be between {current - 100} and {current - 5}."
            raise ValueError(msg)
        return v


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleExchangeRequest(ApiModel):
    code: str


class PasswordChangeRequest(ApiModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _password_complexity(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            msg = "Must contain at least one letter and one number."
            raise ValueError(msg)
        return v


class AuthResponse(ApiModel):
    user: UserOut
