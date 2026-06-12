"""User read/write helpers + ORM → DTO conversion."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.user import UserOut
from app.db.models.interest import UserInterest
from app.db.models.user import User


def derive_grade_level(year_of_birth: int) -> int:
    """Linear: grade = age − 5, clamped 1..12 (PRD §1.4)."""
    age = datetime.now(UTC).year - year_of_birth
    return max(1, min(12, age - 5))


async def load_interest_slugs(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    stmt = (
        select(UserInterest.interest_slug)
        .where(UserInterest.user_id == user_id)
        .order_by(UserInterest.created_at.asc())
    )
    rows = await db.execute(stmt)
    return [r[0] for r in rows.all()]


async def to_user_out(db: AsyncSession, user: User) -> UserOut:
    interests = await load_interest_slugs(db, user.id)
    return UserOut.model_validate(
        {
            "id": user.id,
            "email": user.email,
            "email_verified": user.email_verified,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "year_of_birth": user.year_of_birth,
            "grade_level": user.grade_level,
            "phone_number": user.phone_number,
            "avatar_url": user.avatar_url,
            "display_locale": user.display_locale,
            "theme_preference": user.theme_preference,
            "text_size_preference": user.text_size_preference,
            "reduce_motion": user.reduce_motion,
            "notif_email_enabled": user.notif_email_enabled,
            "notif_inapp_enabled": user.notif_inapp_enabled,
            "interests": interests,
            "role": user.role,
            "status": user.status,
            "created_at": user.created_at,
        }
    )
