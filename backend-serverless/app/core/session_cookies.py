"""Session cookie helpers for browser-managed auth."""

from __future__ import annotations

import secrets

from fastapi import Response

from app.config import get_settings
from app.core.security import create_access_token, create_refresh_token

ACCESS_COOKIE = "st_at"
REFRESH_COOKIE = "rt"
CSRF_COOKIE = "st_csrf"
CSRF_HEADER = "X-CSRF-Token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def cookie_secure() -> bool:
    settings = get_settings()
    if settings.auth_cookie_secure is not None:
        return settings.auth_cookie_secure
    return settings.environment not in {"dev", "local", "test"}


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_access_cookie(response: Response, user_id: str) -> None:
    token, max_age = create_access_token(user_id)
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        path="/",
    )


def set_refresh_cookie(response: Response, user_id: str) -> None:
    token, max_age = create_refresh_token(user_id)
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=cookie_secure(),
        samesite="lax",
        path="/",
    )


def set_csrf_cookie(response: Response, value: str | None = None) -> str:
    settings = get_settings()
    token = value or new_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE,
        value=token,
        max_age=settings.jwt_refresh_ttl_seconds,
        httponly=False,
        secure=cookie_secure(),
        samesite="lax",
        path="/",
    )
    response.headers[CSRF_HEADER] = token
    return token


def set_session_cookies(response: Response, user_id: str) -> None:
    set_access_cookie(response, user_id)
    set_refresh_cookie(response, user_id)
    set_csrf_cookie(response)


def clear_session_cookies(response: Response) -> None:
    secure = cookie_secure()
    for key in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(key, path="/", secure=secure, samesite="lax")
