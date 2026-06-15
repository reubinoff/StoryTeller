"""Admin console business logic and safety checks."""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.v1.schemas.admin import (
    AdminAuditEventOut,
    AdminCourseMetric,
    AdminDailyActivity,
    AdminOverviewKpis,
    AdminOverviewOut,
    AdminTaskStatusCount,
    AdminUserDetail,
    AdminUserSummary,
)
from app.api.v1.schemas.common import Page
from app.config import get_settings
from app.core.errors import AppError
from app.db.models.admin import AdminAuditEvent
from app.db.models.interest import UserInterest
from app.db.models.task import Task
from app.db.models.user import User


ADMIN_ROLE = "admin"
USER_ROLE = "user"
ADMIN_ASSIGNABLE_STATUSES = {"active", "suspended"}


def bootstrap_admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in get_settings().admin_bootstrap_emails
        if email.strip()
    }


def is_protected_admin(user: User) -> bool:
    return user.email.lower() in bootstrap_admin_emails()


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


async def record_audit_event(
    db: AsyncSession,
    *,
    actor_user_id: uuid.UUID | None,
    target_user_id: uuid.UUID,
    action: str,
    metadata: dict[str, Any],
) -> None:
    db.add(
        AdminAuditEvent(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            action=action,
            event_metadata=metadata,
        )
    )


async def ensure_bootstrap_admin(
    db: AsyncSession, user: User, *, commit: bool = False
) -> bool:
    if not is_protected_admin(user) or user.role == ADMIN_ROLE:
        return False
    before_role = user.role
    user.role = ADMIN_ROLE
    await record_audit_event(
        db,
        actor_user_id=None,
        target_user_id=user.id,
        action="bootstrap_admin_promoted",
        metadata={"from_role": before_role, "to_role": ADMIN_ROLE},
    )
    if commit:
        await db.commit()
        await db.refresh(user)
    else:
        await db.flush()
    return True


async def active_admin_count(db: AsyncSession) -> int:
    count_q = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.role == ADMIN_ROLE, User.status == "active")
    )
    return int(count_q.scalar_one() or 0)


def _page_cursor(cursor: str | None) -> int:
    if cursor is None:
        return 0
    try:
        offset = int(cursor)
    except ValueError as exc:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Validation failed",
            errors=[{"field": "cursor", "message": "Cursor must be a numeric offset."}],
        ) from exc
    return max(0, offset)


def _admin_user_summary(
    user: User,
    *,
    tasks_total: int = 0,
    tasks_completed: int = 0,
    avg_score: float | None = None,
    last_activity_at: datetime | None = None,
) -> AdminUserSummary:
    return AdminUserSummary(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,  # type: ignore[arg-type]
        status=user.status,  # type: ignore[arg-type]
        protected_admin=is_protected_admin(user),
        created_at=user.created_at,
        updated_at=user.updated_at,
        tasks_total=tasks_total,
        tasks_completed=tasks_completed,
        avg_score=avg_score,
        last_activity_at=last_activity_at,
    )


async def _task_metrics_by_user(
    db: AsyncSession, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict[str, Any]]:
    if not user_ids:
        return {}
    rows = await db.execute(
        select(Task.user_id, Task.status, Task.score, Task.updated_at).where(
            Task.user_id.in_(user_ids)
        )
    )
    metrics: dict[uuid.UUID, dict[str, Any]] = {
        user_id: {
            "tasks_total": 0,
            "tasks_completed": 0,
            "score_total": 0.0,
            "score_count": 0,
            "last_activity_at": None,
        }
        for user_id in user_ids
    }
    for user_id, status, score, updated_at in rows.all():
        row_metrics = metrics[user_id]
        row_metrics["tasks_total"] += 1
        if status == "completed":
            row_metrics["tasks_completed"] += 1
            if score is not None:
                row_metrics["score_total"] += float(score)
                row_metrics["score_count"] += 1
        updated_at = _as_utc(updated_at)
        if (
            row_metrics["last_activity_at"] is None
            or updated_at > row_metrics["last_activity_at"]
        ):
            row_metrics["last_activity_at"] = updated_at
    return metrics


def _summary_with_metrics(user: User, metrics: dict[str, Any]) -> AdminUserSummary:
    score_count = int(metrics.get("score_count") or 0)
    avg_score = None
    if score_count:
        avg_score = round(float(metrics["score_total"]) / score_count, 1)
    return _admin_user_summary(
        user,
        tasks_total=int(metrics.get("tasks_total") or 0),
        tasks_completed=int(metrics.get("tasks_completed") or 0),
        avg_score=avg_score,
        last_activity_at=metrics.get("last_activity_at"),
    )


async def get_admin_user_summary(db: AsyncSession, user: User) -> AdminUserSummary:
    metrics = (await _task_metrics_by_user(db, [user.id])).get(user.id, {})
    return _summary_with_metrics(user, metrics)


async def get_overview(db: AsyncSession, *, range_days: int) -> AdminOverviewOut:
    now = datetime.now(UTC)
    window_start = now - timedelta(days=range_days)
    day_buckets: dict[date, dict[str, int]] = {
        (now.date() - timedelta(days=offset)): {
            "signups": 0,
            "tasks_created": 0,
            "tasks_completed": 0,
        }
        for offset in range(range_days - 1, -1, -1)
    }

    users_total_q = await db.execute(select(func.count()).select_from(User))
    users_active_q = await db.execute(
        select(func.count()).select_from(User).where(User.status == "active")
    )
    users_suspended_q = await db.execute(
        select(func.count()).select_from(User).where(User.status == "suspended")
    )
    admins_total_q = await db.execute(
        select(func.count()).select_from(User).where(User.role == ADMIN_ROLE)
    )

    users_in_window = await db.execute(
        select(User.created_at).where(User.created_at >= window_start)
    )
    signups_in_range = 0
    for (created_at,) in users_in_window.all():
        created_at = _as_utc(created_at)
        signups_in_range += 1
        bucket = day_buckets.get(created_at.date())
        if bucket is not None:
            bucket["signups"] += 1

    task_rows = await db.execute(
        select(
            Task.created_at,
            Task.completed_at,
            Task.failed_at,
            Task.status,
            Task.course_type,
            Task.score,
        ).where(
            or_(
                Task.created_at >= window_start,
                Task.completed_at >= window_start,
                Task.failed_at >= window_start,
                Task.status == "processing",
            )
        )
    )
    tasks_created_in_range = 0
    tasks_completed_in_range = 0
    tasks_failed_in_range = 0
    writing_processing = 0
    score_total = 0.0
    score_count = 0
    course_metrics: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"completed_count": 0, "score_total": 0.0, "score_count": 0}
    )

    for created_at, completed_at, failed_at, status, course_type, score in task_rows.all():
        created_at = _as_utc(created_at)
        completed_at = _as_utc(completed_at) if completed_at is not None else None
        failed_at = _as_utc(failed_at) if failed_at is not None else None
        if created_at >= window_start:
            tasks_created_in_range += 1
            bucket = day_buckets.get(created_at.date())
            if bucket is not None:
                bucket["tasks_created"] += 1
        if completed_at is not None and completed_at >= window_start:
            tasks_completed_in_range += 1
            bucket = day_buckets.get(completed_at.date())
            if bucket is not None:
                bucket["tasks_completed"] += 1
            course_row = course_metrics[course_type]
            course_row["completed_count"] = int(course_row["completed_count"]) + 1
            if score is not None:
                score_float = float(score)
                score_total += score_float
                score_count += 1
                course_row["score_total"] = float(course_row["score_total"]) + score_float
                course_row["score_count"] = int(course_row["score_count"]) + 1
        if failed_at is not None and failed_at >= window_start:
            tasks_failed_in_range += 1
        if status == "processing":
            writing_processing += 1

    return AdminOverviewOut(
        range_days=range_days,  # type: ignore[arg-type]
        generated_at=now,
        kpis=AdminOverviewKpis(
            users_total=int(users_total_q.scalar_one() or 0),
            users_active=int(users_active_q.scalar_one() or 0),
            users_suspended=int(users_suspended_q.scalar_one() or 0),
            admins_total=int(admins_total_q.scalar_one() or 0),
            signups_in_range=signups_in_range,
            tasks_created_in_range=tasks_created_in_range,
            tasks_completed_in_range=tasks_completed_in_range,
            tasks_failed_in_range=tasks_failed_in_range,
            writing_processing=writing_processing,
            avg_completed_score=round(score_total / score_count, 1) if score_count else 0.0,
        ),
        daily_activity=[
            AdminDailyActivity(date=day, **values) for day, values in day_buckets.items()
        ],
        course_metrics=[
            AdminCourseMetric(
                course_type=course_type,
                completed_count=int(values["completed_count"]),
                avg_score=round(float(values["score_total"]) / int(values["score_count"]), 1)
                if int(values["score_count"])
                else 0.0,
            )
            for course_type, values in sorted(course_metrics.items())
        ],
    )


async def list_users(
    db: AsyncSession,
    *,
    query: str | None,
    role: str | None,
    status: str | None,
    limit: int,
    cursor: str | None,
) -> Page[AdminUserSummary]:
    offset = _page_cursor(cursor)
    stmt = select(User).order_by(User.created_at.desc(), User.id.desc())
    if query:
        like = f"%{query.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.email).like(like),
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
            )
        )
    if role:
        stmt = stmt.where(User.role == role)
    if status:
        stmt = stmt.where(User.status == status)
    rows = await db.execute(stmt.offset(offset).limit(limit + 1))
    users = list(rows.scalars().all())
    next_cursor = str(offset + limit) if len(users) > limit else None
    visible_users = users[:limit]
    metrics = await _task_metrics_by_user(db, [user.id for user in visible_users])
    return Page(
        items=[
            _summary_with_metrics(user, metrics.get(user.id, {})) for user in visible_users
        ],
        next_cursor=next_cursor,
    )


async def get_user_detail(db: AsyncSession, user_id: uuid.UUID) -> AdminUserDetail:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(status_code=404, code="not_found", title="User not found")

    summary = await get_admin_user_summary(db, user)
    interests_q = await db.execute(
        select(UserInterest.interest_slug)
        .where(UserInterest.user_id == user.id)
        .order_by(UserInterest.created_at)
    )
    status_counts_q = await db.execute(
        select(Task.status, func.count())
        .where(Task.user_id == user.id)
        .group_by(Task.status)
        .order_by(Task.status)
    )
    return AdminUserDetail(
        **summary.model_dump(),
        email_verified=user.email_verified,
        grade_level=user.grade_level,
        year_of_birth=user.year_of_birth,
        onboarding_completed=user.onboarding_completed,
        interests=[row[0] for row in interests_q.all()],
        task_status_counts=[
            AdminTaskStatusCount(status=status, count=int(count or 0))
            for status, count in status_counts_q.all()
        ],
    )


async def set_user_admin(
    db: AsyncSession, *, actor: User, target_user_id: uuid.UUID, is_admin: bool
) -> AdminUserDetail:
    target = await db.get(User, target_user_id)
    if target is None:
        raise AppError(status_code=404, code="not_found", title="User not found")
    if target.status == "deleted":
        raise AppError(
            status_code=409,
            code="admin_safety_violation",
            title="Deleted users cannot be managed",
        )
    if is_admin and target.status != "active":
        raise AppError(
            status_code=409,
            code="admin_safety_violation",
            title="Only active users can be promoted to admin",
        )
    if not is_admin:
        if target.id == actor.id:
            raise AppError(
                status_code=409,
                code="admin_safety_violation",
                title="You cannot remove your own admin access",
            )
        if is_protected_admin(target):
            raise AppError(
                status_code=403,
                code="protected_admin",
                title="Protected admin cannot be demoted",
            )
        if target.role == ADMIN_ROLE and target.status == "active":
            count = await active_admin_count(db)
            if count <= 1:
                raise AppError(
                    status_code=409,
                    code="admin_safety_violation",
                    title="Cannot remove the last active admin",
                )

    before_role = target.role
    target.role = ADMIN_ROLE if is_admin else USER_ROLE
    if before_role != target.role:
        await record_audit_event(
            db,
            actor_user_id=actor.id,
            target_user_id=target.id,
            action="admin_granted" if is_admin else "admin_revoked",
            metadata={"from_role": before_role, "to_role": target.role},
        )
    await db.commit()
    return await get_user_detail(db, target.id)


async def set_user_status(
    db: AsyncSession, *, actor: User, target_user_id: uuid.UUID, status: str
) -> AdminUserDetail:
    if status not in ADMIN_ASSIGNABLE_STATUSES:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Validation failed",
            errors=[{"field": "status", "message": "Must be active or suspended."}],
        )
    target = await db.get(User, target_user_id)
    if target is None:
        raise AppError(status_code=404, code="not_found", title="User not found")
    if target.status == "deleted":
        raise AppError(
            status_code=409,
            code="admin_safety_violation",
            title="Deleted users cannot be managed",
        )
    if status == "suspended":
        if target.id == actor.id:
            raise AppError(
                status_code=409,
                code="admin_safety_violation",
                title="You cannot suspend yourself",
            )
        if is_protected_admin(target):
            raise AppError(
                status_code=403,
                code="protected_admin",
                title="Protected admin cannot be suspended",
            )
        if target.role == ADMIN_ROLE and target.status == "active":
            count = await active_admin_count(db)
            if count <= 1:
                raise AppError(
                    status_code=409,
                    code="admin_safety_violation",
                    title="Cannot suspend the last active admin",
                )

    before_status = target.status
    target.status = status
    if before_status != target.status:
        await record_audit_event(
            db,
            actor_user_id=actor.id,
            target_user_id=target.id,
            action="user_suspended" if status == "suspended" else "user_reactivated",
            metadata={"from_status": before_status, "to_status": target.status},
        )
    await db.commit()
    return await get_user_detail(db, target.id)


async def list_audit_events(
    db: AsyncSession,
    *,
    target_user_id: uuid.UUID | None,
    limit: int,
    cursor: str | None,
) -> Page[AdminAuditEventOut]:
    offset = _page_cursor(cursor)
    actor_user = aliased(User)
    target_user = aliased(User)
    stmt = (
        select(AdminAuditEvent, actor_user.email, target_user.email)
        .outerjoin(actor_user, actor_user.id == AdminAuditEvent.actor_user_id)
        .join(target_user, target_user.id == AdminAuditEvent.target_user_id)
        .order_by(AdminAuditEvent.created_at.desc(), AdminAuditEvent.id.desc())
    )
    if target_user_id is not None:
        stmt = stmt.where(AdminAuditEvent.target_user_id == target_user_id)
    rows = await db.execute(stmt.offset(offset).limit(limit + 1))
    entries = list(rows.all())
    next_cursor = str(offset + limit) if len(entries) > limit else None
    visible_entries = entries[:limit]
    return Page(
        items=[
            AdminAuditEventOut(
                id=event.id,
                actor_user_id=event.actor_user_id,
                actor_email=actor_email,
                target_user_id=event.target_user_id,
                target_email=target_email,
                action=event.action,
                metadata=event.event_metadata,
                created_at=event.created_at,
            )
            for event, actor_email, target_email in visible_entries
        ],
        next_cursor=next_cursor,
    )
