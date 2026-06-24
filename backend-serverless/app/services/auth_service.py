"""Auth business logic: signup, login."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.auth import LoginRequest, SignupRequest
from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.db.models._helpers import utcnow
from app.db.models.user import AuthCredential, AuthIdentity, User
from app.services import admin_service
from app.services.level_service import (
    default_english_level_for_year_of_birth,
    derive_grade_level,
)

GOOGLE_PROVIDER = "google"


async def signup(db: AsyncSession, body: SignupRequest) -> User:
    email = body.email.lower()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise AppError(
            status_code=409,
            code="email_taken",
            title="Email already in use",
            detail="An account with this email already exists.",
        )
    grade_level = derive_grade_level(body.year_of_birth)
    user = User(
        email=email,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        year_of_birth=body.year_of_birth,
        grade_level=grade_level,
        english_level=default_english_level_for_year_of_birth(body.year_of_birth),
        theme_preference="light",
    )
    db.add(user)
    await db.flush()
    cred = AuthCredential(user_id=user.id, password_hash=hash_password(body.password))
    db.add(cred)
    await admin_service.ensure_bootstrap_admin(db, user)
    await db.commit()
    await db.refresh(user)
    return user


async def login(db: AsyncSession, body: LoginRequest) -> User:
    email = body.email.lower()
    stmt = (
        select(User, AuthCredential).join(AuthCredential, AuthCredential.user_id == User.id).where(User.email == email)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Invalid email or password",
        )
    user, cred = row
    if user.status != "active":
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Invalid email or password",
        )
    if not verify_password(body.password, cred.password_hash):
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Invalid email or password",
        )
    await admin_service.ensure_bootstrap_admin(db, user, commit=True)
    return user


def _google_email_verified(value: Any) -> bool:
    return value is True or str(value).lower() == "true"


def _google_names(profile: Mapping[str, Any], email: str) -> tuple[str, str]:
    given = str(profile.get("given_name") or "").strip()
    family = str(profile.get("family_name") or "").strip()
    if not given:
        parts = str(profile.get("name") or "").strip().split(None, 1)
        if parts:
            given = parts[0]
            if not family and len(parts) > 1:
                family = parts[1]
    if not given:
        given = email.split("@", 1)[0]
    if not family:
        family = "Learner"
    return given[:40], family[:40]


async def login_or_signup_google(db: AsyncSession, profile: Mapping[str, Any]) -> User:
    subject = str(profile.get("sub") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    email_verified = _google_email_verified(profile.get("email_verified"))
    avatar_url = str(profile.get("picture") or "").strip() or None

    if not subject or not email:
        raise AppError(
            status_code=401,
            code="invalid_google_profile",
            title="Google sign-in failed",
            detail="Google did not return the required profile fields.",
        )
    if not email_verified:
        raise AppError(
            status_code=401,
            code="google_email_unverified",
            title="Google email is not verified",
            detail="Use a verified Google email address to sign in.",
        )

    linked_stmt = (
        select(User, AuthIdentity)
        .join(AuthIdentity, AuthIdentity.user_id == User.id)
        .where(
            AuthIdentity.provider == GOOGLE_PROVIDER,
            AuthIdentity.provider_subject == subject,
        )
    )
    linked = (await db.execute(linked_stmt)).first()
    if linked is not None:
        user, identity = linked
        if user.status != "active":
            raise AppError(
                status_code=401,
                code="invalid_credentials",
                title="Invalid email or password",
            )
        identity.email = email
        identity.email_verified = True
        identity.avatar_url = avatar_url
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        if user.email_verified_at is None:
            user.email_verified_at = utcnow()
        await admin_service.ensure_bootstrap_admin(db, user)
        await db.commit()
        await db.refresh(user)
        return user

    existing = await db.execute(select(User).where(User.email == email))
    user = existing.scalar_one_or_none()
    if user is not None and user.status != "active":
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Invalid email or password",
        )

    if user is None:
        first_name, last_name = _google_names(profile, email)
        year_of_birth = utcnow().year - 12
        grade_level = derive_grade_level(year_of_birth)
        user = User(
            email=email,
            email_verified_at=utcnow(),
            first_name=first_name,
            last_name=last_name,
            year_of_birth=year_of_birth,
            grade_level=grade_level,
            english_level=default_english_level_for_year_of_birth(year_of_birth),
            avatar_url=avatar_url,
            theme_preference="light",
        )
        db.add(user)
        await db.flush()
    else:
        if user.email_verified_at is None:
            user.email_verified_at = utcnow()
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url

    await admin_service.ensure_bootstrap_admin(db, user)
    db.add(
        AuthIdentity(
            user_id=user.id,
            provider=GOOGLE_PROVIDER,
            provider_subject=subject,
            email=email,
            email_verified=True,
            avatar_url=avatar_url,
        )
    )
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    cred = await db.get(AuthCredential, user.id)
    if cred is None or not verify_password(current_password, cred.password_hash):
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Current password is incorrect",
        )
    cred.password_hash = hash_password(new_password)
    await db.commit()
