"""Admin API DTOs."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field

from app.api.v1.schemas.common import ApiModel
from app.api.v1.schemas.user import UserRole, UserStatus

AdminRangeDays = Literal[7, 30, 90]
AdminAssignableStatus = Literal["active", "suspended"]


class AdminOverviewKpis(ApiModel):
    users_total: int
    users_active: int
    users_suspended: int
    admins_total: int
    signups_in_range: int
    tasks_created_in_range: int
    tasks_completed_in_range: int
    tasks_failed_in_range: int
    writing_processing: int
    avg_completed_score: float


class AdminDailyActivity(ApiModel):
    date: date
    signups: int
    tasks_created: int
    tasks_completed: int


class AdminCourseMetric(ApiModel):
    course_type: str
    completed_count: int
    avg_score: float


class AdminOverviewOut(ApiModel):
    range_days: AdminRangeDays
    generated_at: datetime
    kpis: AdminOverviewKpis
    daily_activity: list[AdminDailyActivity]
    course_metrics: list[AdminCourseMetric]


class AdminUserSummary(ApiModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    status: UserStatus
    protected_admin: bool
    created_at: datetime
    updated_at: datetime
    tasks_total: int = 0
    tasks_completed: int = 0
    avg_score: float | None = None
    last_activity_at: datetime | None = None


class AdminSessionOut(ApiModel):
    user: AdminUserSummary
    protected_admin: bool


class AdminTaskStatusCount(ApiModel):
    status: str
    count: int


class AdminUserDetail(AdminUserSummary):
    email_verified: bool
    grade_level: int
    year_of_birth: int
    onboarding_completed: bool
    interests: list[str]
    task_status_counts: list[AdminTaskStatusCount]


class AdminSetAdminRequest(ApiModel):
    is_admin: bool


class AdminSetStatusRequest(ApiModel):
    status: AdminAssignableStatus


class AdminAuditEventOut(ApiModel):
    id: UUID
    actor_user_id: UUID | None
    actor_email: EmailStr | None = None
    target_user_id: UUID
    target_email: EmailStr | None = None
    action: str
    metadata: dict[str, object] = Field(default_factory=dict)
    created_at: datetime
