"""Authentication endpoints."""

from __future__ import annotations

import asyncio
import uuid
from typing import Annotated, Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, Query, Response, status
from fastapi.responses import RedirectResponse
from jwt import PyJWKClient

from app.api.v1.schemas.auth import (
    AccessTokenResponse,
    AuthResponse,
    LoginRequest,
    SignupRequest,
)
from app.config import get_settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    create_oauth_state,
    create_refresh_token,
    decode_oauth_state,
    decode_refresh_token,
)
from app.db.models.user import User
from app.deps import DbSession
from app.services import auth_service
from app.services.user_service import to_user_out

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "rt"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"

_google_jwks_client = PyJWKClient(GOOGLE_JWKS_URL)


def _safe_return_to(value: str | None, fallback: str = "/dashboard") -> str:
    if not value or not value.startswith("/") or value.startswith("//"):
        return fallback
    if value.startswith(("/login", "/signup", "/auth/callback")):
        return fallback
    return value


def _cookie_secure() -> bool:
    settings = get_settings()
    if settings.auth_cookie_secure is not None:
        return settings.auth_cookie_secure
    return settings.environment not in {"dev", "local", "test"}


def _frontend_callback_url(return_to: str, error: str | None = None) -> str:
    settings = get_settings()
    query: dict[str, str] = {"returnTo": _safe_return_to(return_to)}
    if error:
        query["error"] = error
    return f"{settings.frontend_base_url.rstrip('/')}/auth/callback?{urlencode(query)}"


def _set_refresh_cookie(response: Response, user_id: str) -> None:
    token, max_age = create_refresh_token(user_id)
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        path="/",
    )


async def _user_from_refresh_cookie(db: DbSession, refresh_token: str | None) -> User:
    if not refresh_token:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Missing refresh cookie.",
        )
    try:
        payload = decode_refresh_token(refresh_token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except Exception as exc:
        raise AppError(
            status_code=401,
            code="unauthenticated",
            title="Authentication required",
            detail="Invalid or expired refresh cookie.",
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


async def _exchange_google_code(code: str) -> dict[str, Any]:
    settings = get_settings()
    if not (
        settings.google_oauth_client_id
        and settings.google_oauth_client_secret
        and settings.google_oauth_redirect_uri
    ):
        raise AppError(
            status_code=503,
            code="google_oauth_not_configured",
            title="Google sign-in is not configured",
        )
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_oauth_client_id,
                "client_secret": settings.google_oauth_client_secret,
                "redirect_uri": settings.google_oauth_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code >= 400:
        raise AppError(
            status_code=401,
            code="google_token_exchange_failed",
            title="Google sign-in failed",
            detail="Could not exchange the Google authorization code.",
        )
    return response.json()


async def _verify_google_id_token(id_token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        signing_key = await asyncio.to_thread(
            _google_jwks_client.get_signing_key_from_jwt, id_token
        )
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.google_oauth_client_id,
        )
    except Exception as exc:
        raise AppError(
            status_code=401,
            code="google_id_token_invalid",
            title="Google sign-in failed",
            detail="Google returned an invalid identity token.",
        ) from exc
    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise AppError(
            status_code=401,
            code="google_id_token_invalid",
            title="Google sign-in failed",
            detail="Google returned an invalid identity issuer.",
        )
    return payload


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response, db: DbSession) -> AuthResponse:
    user = await auth_service.signup(db, body)
    token, expires_in = create_access_token(str(user.id))
    _set_refresh_cookie(response, str(user.id))
    return AuthResponse(access_token=token, expires_in=expires_in, user=await to_user_out(db, user))


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response, db: DbSession) -> AuthResponse:
    user = await auth_service.login(db, body)
    token, expires_in = create_access_token(str(user.id))
    _set_refresh_cookie(response, str(user.id))
    return AuthResponse(access_token=token, expires_in=expires_in, user=await to_user_out(db, user))


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> AccessTokenResponse:
    current_user = await _user_from_refresh_cookie(db, refresh_token)
    token, expires_in = create_access_token(str(current_user.id))
    _set_refresh_cookie(response, str(current_user.id))
    return AccessTokenResponse(access_token=token, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(REFRESH_COOKIE, path="/", samesite="lax")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/google/start")
async def google_start(
    return_to: Annotated[str, Query(alias="return_to")] = "/dashboard",
    intent: str = "login",
) -> RedirectResponse:
    settings = get_settings()
    if not (
        settings.google_oauth_client_id
        and settings.google_oauth_client_secret
        and settings.google_oauth_redirect_uri
    ):
        raise AppError(
            status_code=503,
            code="google_oauth_not_configured",
            title="Google sign-in is not configured",
        )
    safe_return_to = _safe_return_to(return_to)
    safe_intent = intent if intent in {"login", "signup"} else "login"
    state = create_oauth_state(return_to=safe_return_to, intent=safe_intent)
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(
    db: DbSession,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    return_to = "/dashboard"
    try:
        if state:
            state_payload = decode_oauth_state(state)
            return_to = _safe_return_to(str(state_payload.get("return_to") or ""))
    except Exception:
        return RedirectResponse(_frontend_callback_url(return_to, "invalid_oauth_state"))

    if error:
        return RedirectResponse(_frontend_callback_url(return_to, "google_oauth_denied"))
    if not code:
        return RedirectResponse(_frontend_callback_url(return_to, "missing_google_code"))

    try:
        token_payload = await _exchange_google_code(code)
        id_token = str(token_payload.get("id_token") or "")
        profile = await _verify_google_id_token(id_token)
        user = await auth_service.login_or_signup_google(db, profile)
    except AppError as exc:
        return RedirectResponse(_frontend_callback_url(return_to, exc.code))
    except Exception:
        return RedirectResponse(_frontend_callback_url(return_to, "google_oauth_failed"))

    redirect = RedirectResponse(_frontend_callback_url(return_to))
    _set_refresh_cookie(redirect, str(user.id))
    return redirect


@router.post("/google/exchange", status_code=status.HTTP_410_GONE)
async def google_exchange_removed() -> None:
    raise AppError(
        status_code=410,
        code="google_exchange_removed",
        title="Use /auth/google/start for Google sign-in",
    )


@router.post("/email/verify/request", status_code=status.HTTP_204_NO_CONTENT)
async def email_verify_request() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/email/verify/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def email_verify_confirm() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/forgot", status_code=status.HTTP_204_NO_CONTENT)
async def password_forgot() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password/reset", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def password_reset() -> None:
    raise AppError(
        status_code=501, code="not_implemented", title="Password reset not implemented in v1"
    )
