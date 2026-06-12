"""Auth business logic: signup, login."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.auth import LoginRequest, SignupRequest
from app.core.errors import AppError
from app.core.security import hash_password, verify_password
from app.db.models.user import AuthCredential, User
from app.services.user_service import derive_grade_level


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
    user = User(
        email=email,
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        year_of_birth=body.year_of_birth,
        grade_level=derive_grade_level(body.year_of_birth),
    )
    db.add(user)
    await db.flush()
    cred = AuthCredential(user_id=user.id, password_hash=hash_password(body.password))
    db.add(cred)
    await db.commit()
    await db.refresh(user)
    return user


async def login(db: AsyncSession, body: LoginRequest) -> User:
    email = body.email.lower()
    stmt = (
        select(User, AuthCredential)
        .join(AuthCredential, AuthCredential.user_id == User.id)
        .where(User.email == email)
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
    return user


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> None:
    cred = await db.get(AuthCredential, user.id)
    if cred is None or not verify_password(current_password, cred.password_hash):
        raise AppError(
            status_code=401,
            code="invalid_credentials",
            title="Current password is incorrect",
        )
    cred.password_hash = hash_password(new_password)
    await db.commit()
