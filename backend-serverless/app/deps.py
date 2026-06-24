"""Common FastAPI dependencies (DB session, current user)."""

from __future__ import annotations

import secrets
import uuid
from typing import Annotated

from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.core.session_cookies import ACCESS_COOKIE, CSRF_COOKIE, SAFE_METHODS
from app.db.models.user import User
from app.db.session import get_session
from app.services import admin_service


async def get_db() -> AsyncSession:  # type: ignore[empty-body]
    """Re-exposes db.session.get_session for clarity at the router layer."""
    raise NotImplementedError  # FastAPI never calls this; kept for type hints.


DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    db: DbSession,
    request: Request,
    access_token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
    csrf_cookie: Annotated[str | None, Cookie(alias=CSRF_COOKIE)] = None,
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> User:
    if not access_token:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Missing access cookie.",
        )
    try:
        payload = decode_access_token(access_token)
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
    if request.method.upper() not in SAFE_METHODS:
        if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
            raise AppError(
                status_code=403,
                code="csrf_mismatch",
                title="Security check failed",
                detail="Missing or invalid CSRF token.",
            )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_current_admin_user(db: DbSession, current_user: CurrentUser) -> User:
    await admin_service.ensure_bootstrap_admin(db, current_user, commit=True)
    if current_user.role != admin_service.ADMIN_ROLE:
        raise AppError(
            status_code=403,
            code="admin_required",
            title="Admin access required",
            detail="This endpoint is restricted to active administrators.",
        )
    return current_user


CurrentAdminUser = Annotated[User, Depends(get_current_admin_user)]
