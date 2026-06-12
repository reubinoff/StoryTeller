"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.v1.schemas.auth import (
    AccessTokenResponse,
    AuthResponse,
    GoogleExchangeRequest,
    LoginRequest,
    SignupRequest,
)
from app.core.errors import AppError
from app.core.security import create_access_token
from app.deps import CurrentUser, DbSession
from app.services import auth_service
from app.services.user_service import to_user_out

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "rt"
REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30


def _set_refresh_cookie(response: Response, user_id: str) -> None:
    """Set a placeholder refresh cookie. v1 has no rotation/family."""
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=f"v1.{user_id}",
        max_age=REFRESH_TTL_SECONDS,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, response: Response, db: DbSession) -> AuthResponse:
    user = await auth_service.signup(db, body)
    token, expires_in = create_access_token(str(user.id))
    _set_refresh_cookie(response, str(user.id))
    return AuthResponse(
        access_token=token, expires_in=expires_in, user=await to_user_out(db, user)
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, response: Response, db: DbSession) -> AuthResponse:
    user = await auth_service.login(db, body)
    token, expires_in = create_access_token(str(user.id))
    _set_refresh_cookie(response, str(user.id))
    return AuthResponse(
        access_token=token, expires_in=expires_in, user=await to_user_out(db, user)
    )


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(current_user: CurrentUser, response: Response) -> AccessTokenResponse:
    """v1: re-issue an access token if the bearer is still valid (no rotation)."""
    token, expires_in = create_access_token(str(current_user.id))
    _set_refresh_cookie(response, str(current_user.id))
    return AccessTokenResponse(access_token=token, expires_in=expires_in)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> Response:
    response.delete_cookie(REFRESH_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/google/exchange", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def google_exchange(_body: GoogleExchangeRequest) -> None:
    raise AppError(
        status_code=501, code="not_implemented", title="Google OAuth not implemented in v1"
    )


@router.get("/google/start", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def google_start() -> None:
    raise AppError(
        status_code=501, code="not_implemented", title="Google OAuth not implemented in v1"
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
