"""RFC 7807 Problem Details error responses + handlers."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_BASE = "https://errors.storyteller.app/"
PROBLEM_CONTENT_TYPE = "application/problem+json"


class AppError(Exception):
    """Domain-level error that maps cleanly to RFC 7807."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        title: str,
        detail: str | None = None,
        errors: list[dict[str, str]] | None = None,
    ) -> None:
        super().__init__(detail or title)
        self.status_code = status_code
        self.code = code
        self.title = title
        self.detail = detail
        self.errors = errors


def problem_response(
    *,
    status_code: int,
    code: str,
    title: str,
    detail: str | None = None,
    errors: list[dict[str, str]] | None = None,
    request_id: str | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"{PROBLEM_BASE}{code}",
        "title": title,
        "status": status_code,
        "code": code,
    }
    if detail:
        body["detail"] = detail
    if errors:
        body["errors"] = errors
    headers = {"Content-Type": PROBLEM_CONTENT_TYPE}
    if request_id:
        headers["X-Request-Id"] = request_id
    return JSONResponse(status_code=status_code, content=body, headers=headers)


_HTTP_CODE_MAP: dict[int, tuple[str, str]] = {
    400: ("invalid_state", "Invalid request"),
    401: ("unauthenticated", "Authentication required"),
    403: ("forbidden", "Forbidden"),
    404: ("not_found", "Resource not found"),
    405: ("method_not_allowed", "Method not allowed"),
    409: ("conflict", "Conflict"),
    422: ("validation_error", "Validation failed"),
    429: ("rate_limited", "Too many requests"),
    501: ("not_implemented", "Not implemented"),
    503: ("unavailable", "Service unavailable"),
}


def _request_id(request: Request) -> str | None:
    rid = request.headers.get("X-Request-Id")
    if rid is not None:
        return rid
    state_rid = getattr(request.state, "request_id", None)
    return state_rid if isinstance(state_rid, str) else None


async def app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):
        raise exc
    return problem_response(
        status_code=exc.status_code,
        code=exc.code,
        title=exc.title,
        detail=exc.detail,
        errors=exc.errors,
        request_id=_request_id(request),
    )


async def http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):
        raise exc
    code, title = _HTTP_CODE_MAP.get(exc.status_code, ("error", "Error"))
    detail = str(exc.detail) if exc.detail else None
    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code", code))
        title = str(exc.detail.get("title", title))
        detail = exc.detail.get("detail")
    return problem_response(
        status_code=exc.status_code,
        code=code,
        title=title,
        detail=detail,
        request_id=_request_id(request),
    )


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, RequestValidationError):
        raise exc
    errors: list[dict[str, str]] = []
    for err in exc.errors():
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
        field = ".".join(loc) if loc else "body"
        errors.append({"field": field, "message": err.get("msg", "Invalid value")})
    return problem_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        title="Validation failed",
        detail="One or more fields are invalid.",
        errors=errors,
        request_id=_request_id(request),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return problem_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_error",
        title="Internal server error",
        detail="An unexpected error occurred.",
        request_id=_request_id(request),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
