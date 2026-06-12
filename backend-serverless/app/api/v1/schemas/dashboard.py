"""Dashboard / achievements / notifications DTOs."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from app.api.v1.schemas.catalog import CourseOut
from app.api.v1.schemas.common import ApiModel
from app.api.v1.schemas.task import CourseType, TaskStatus


class DashboardMetrics(ApiModel):
    tasks_completed: int
    current_streak: int
    longest_streak: int
    avg_score: float
    xp_total: int
    level: int
    level_label: str


class TaskProgress(ApiModel):
    current: int
    total: int
    percentage: int
    label: str


class RecentTask(ApiModel):
    id: UUID
    course: str
    course_type: CourseType
    topic: str
    status: TaskStatus
    score: float | None
    when: str
    progress: TaskProgress | None = None


class AchievementOut(ApiModel):
    id: str
    slug: str
    name: str
    description: str
    icon: str
    earned: bool
    earned_at: datetime | None


class DashboardResponse(ApiModel):
    greeting: str
    metrics: DashboardMetrics
    in_progress: list[RecentTask]
    recent: list[RecentTask]
    recommended: list[CourseOut]
    achievements_recent: list[AchievementOut]


NotificationKind = Literal["task_completed", "task_failed", "streak_milestone", "system"]


class NotificationOut(ApiModel):
    id: UUID
    kind: NotificationKind
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime
