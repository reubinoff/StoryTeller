"""Common FastAPI dependencies (DB session, current user)."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.models.user import User
from app.db.session import get_session


async def get_db() -> AsyncSession:  # type: ignore[empty-body]
    """Re-exposes db.session.get_session for clarity at the router layer."""
    raise NotImplementedError  # FastAPI never calls this; kept for type hints.


DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Missing Authorization header.",
        )
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Authorization header must be 'Bearer <token>'.",
        )
    token = parts[1].strip()
    try:
        payload = decode_access_token(token)
    except Exception as exc:  # jwt errors
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Invalid or expired token.",
        ) from exc
    sub = payload.get("sub")
    if not sub:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
        )
    try:
        user_id = uuid.UUID(str(sub))
    except ValueError as exc:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
        ) from exc
    user = await db.get(User, user_id)
    if user is None or user.status != "active":
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Account is not active.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
