"""Admin console endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated, cast

from fastapi import APIRouter, Query

from app.api.v1.schemas.admin import (
    AdminAuditEventOut,
    AdminOverviewOut,
    AdminRangeDays,
    AdminSessionOut,
    AdminSetAdminRequest,
    AdminSetStatusRequest,
    AdminUserDetail,
    AdminUserSummary,
)
from app.api.v1.schemas.common import Page
from app.api.v1.schemas.user import UserRole, UserStatus
from app.core.errors import AppError
from app.deps import CurrentAdminUser, DbSession
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])
ADMIN_RANGE_DAY_VALUES = {7, 30, 90}


def _parse_user_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise AppError(status_code=404, code="not_found", title="User not found") from exc


def _parse_range_days(value: int) -> AdminRangeDays:
    if value not in ADMIN_RANGE_DAY_VALUES:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Validation failed",
            detail="One or more fields are invalid.",
            errors=[
                {
                    "field": "range_days",
                    "message": "Input should be 7, 30 or 90.",
                }
            ],
        )
    return cast(AdminRangeDays, value)


@router.get("/session", response_model=AdminSessionOut)
async def admin_session(current_admin: CurrentAdminUser, db: DbSession) -> AdminSessionOut:
    return AdminSessionOut(
        user=await admin_service.get_admin_user_summary(db, current_admin),
        protected_admin=admin_service.is_protected_admin(current_admin),
    )


@router.get("/overview", response_model=AdminOverviewOut)
async def admin_overview(
    current_admin: CurrentAdminUser,  # noqa: ARG001
    db: DbSession,
    range_days: Annotated[int, Query()] = 30,
) -> AdminOverviewOut:
    return await admin_service.get_overview(
        db,
        range_days=_parse_range_days(range_days),
    )


@router.get("/users", response_model=Page[AdminUserSummary])
async def admin_users(
    current_admin: CurrentAdminUser,  # noqa: ARG001
    db: DbSession,
    query: Annotated[str | None, Query(max_length=120)] = None,
    role: Annotated[UserRole | None, Query()] = None,
    status: Annotated[UserStatus | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
) -> Page[AdminUserSummary]:
    return await admin_service.list_users(
        db,
        query=query,
        role=role,
        status=status,
        limit=limit,
        cursor=cursor,
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def admin_user_detail(
    user_id: str,
    current_admin: CurrentAdminUser,  # noqa: ARG001
    db: DbSession,
) -> AdminUserDetail:
    return await admin_service.get_user_detail(db, _parse_user_id(user_id))


@router.patch("/users/{user_id}/admin", response_model=AdminUserDetail)
async def admin_set_user_admin(
    user_id: str,
    body: AdminSetAdminRequest,
    current_admin: CurrentAdminUser,
    db: DbSession,
) -> AdminUserDetail:
    return await admin_service.set_user_admin(
        db,
        actor=current_admin,
        target_user_id=_parse_user_id(user_id),
        is_admin=body.is_admin,
    )


@router.patch("/users/{user_id}/status", response_model=AdminUserDetail)
async def admin_set_user_status(
    user_id: str,
    body: AdminSetStatusRequest,
    current_admin: CurrentAdminUser,
    db: DbSession,
) -> AdminUserDetail:
    return await admin_service.set_user_status(
        db,
        actor=current_admin,
        target_user_id=_parse_user_id(user_id),
        status=body.status,
    )


@router.get("/audit", response_model=Page[AdminAuditEventOut])
async def admin_audit(
    current_admin: CurrentAdminUser,  # noqa: ARG001
    db: DbSession,
    target_user_id: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
) -> Page[AdminAuditEventOut]:
    parsed_target_id = _parse_user_id(target_user_id) if target_user_id else None
    return await admin_service.list_audit_events(
        db,
        target_user_id=parsed_target_id,
        limit=limit,
        cursor=cursor,
    )
