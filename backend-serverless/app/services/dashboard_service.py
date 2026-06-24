"""Dashboard, metrics, achievements, notifications domain logic."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.catalog import CourseOut
from app.api.v1.schemas.dashboard import (
    AchievementOut,
    DashboardMetrics,
    DashboardResponse,
    NotificationOut,
    ReadyTasks,
    RecentTask,
    TaskProgress,
)
from app.api.v1.schemas.task import PASSING_SCORE
from app.db.models.achievement import Achievement, UserAchievement
from app.db.models.content import WritingPrompt
from app.db.models.course import Course
from app.db.models.notification import Notification
from app.db.models.streak import Streak
from app.db.models.task import Task
from app.db.models.task_answer import TaskAnswer
from app.db.models.task_question import TaskQuestion
from app.db.models.user import User
from app.services import task_service

_LEVEL_THRESHOLDS = [
    (0, "Apprentice"),
    (250, "Apprentice"),
    (500, "Adept"),
    (1000, "Scholar"),
    (2000, "Sage"),
    (5000, "Legend"),
]


def _level_for_xp(xp: int) -> tuple[int, str]:
    level = 1
    label = "Apprentice"
    for i, (threshold, lbl) in enumerate(_LEVEL_THRESHOLDS, start=1):
        if xp >= threshold:
            level = i
            label = lbl
    return level, label


COURSE_LABELS = {
    "unseen_text": "Reading Adventure",
    "short_writing": "Writing Studio",
}


def _passed(score: float | None) -> bool | None:
    if score is None:
        return None
    return score >= PASSING_SCORE


def _relative_when(when: datetime) -> str:
    now = datetime.now(UTC)
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    diff = now - when
    minutes = int(diff.total_seconds() / 60)
    if minutes < 1:
        return "Just now"
    if minutes < 60:
        return f"{minutes} min ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hr ago"
    days = hours // 24
    if days == 1:
        return "Yesterday"
    return f"{days} days ago"


async def _compute_progress(db: AsyncSession, task: Task) -> TaskProgress | None:
    if task.status not in ("not_started", "in_progress"):
        return None

    if task.course_type == "unseen_text":
        total_q = await db.execute(
            select(func.count()).select_from(TaskQuestion).where(TaskQuestion.task_id == task.id)
        )
        total = int(total_q.scalar_one() or 0)
        answered_q = await db.execute(
            select(func.count())
            .select_from(TaskAnswer)
            .where(
                TaskAnswer.task_id == task.id,
                TaskAnswer.question_id.is_not(None),
                TaskAnswer.answer_text.is_not(None),
            )
        )
        current = int(answered_q.scalar_one() or 0)
        pct = round((current / total) * 100) if total else 0
        return TaskProgress(current=current, total=total, percentage=pct, label=f"{current} of {total} answered")

    if task.course_type == "short_writing":
        text = task.writing_draft or ""
        words = len(text.split()) if text.strip() else 0
        target = 60
        if task.writing_prompt_id is not None:
            prompt = await db.get(WritingPrompt, task.writing_prompt_id)
            if prompt is not None:
                target = prompt.min_words
        return TaskProgress(
            current=words,
            total=target,
            percentage=min(100, round((words / target) * 100)) if target else 0,
            label=f"{words} / {target} words",
        )
    return None


async def _build_recent(db: AsyncSession, user_id: uuid.UUID, limit: int = 20) -> list[RecentTask]:
    rows = await db.execute(select(Task).where(Task.user_id == user_id).order_by(Task.updated_at.desc()).limit(limit))
    out: list[RecentTask] = []
    for t in rows.scalars().all():
        progress = await _compute_progress(db, t)
        out.append(
            RecentTask(
                id=t.id,
                course=COURSE_LABELS.get(t.course_type, t.course_type),
                course_type=t.course_type,  # type: ignore[arg-type]
                topic=t.title,
                status=t.status,  # type: ignore[arg-type]
                score=float(t.score) if t.score is not None else None,
                when=_relative_when(t.updated_at),
                progress=progress,
                passed=_passed(float(t.score) if t.score is not None else None),
            )
        )
    return out


async def get_metrics(db: AsyncSession, user: User) -> DashboardMetrics:
    completed_q = await db.execute(
        select(func.count(), func.coalesce(func.avg(Task.score), 0)).where(
            Task.user_id == user.id, Task.status == "completed"
        )
    )
    completed_count, avg_score = completed_q.one()
    xp_q = await db.execute(select(func.coalesce(func.sum(Task.xp_awarded), 0)).where(Task.user_id == user.id))
    xp_total = int(xp_q.scalar_one() or 0)
    streak = await db.get(Streak, user.id)
    current_streak = streak.current_streak if streak else 0
    longest_streak = streak.longest_streak if streak else 0
    level, label = _level_for_xp(xp_total)
    return DashboardMetrics(
        tasks_completed=int(completed_count or 0),
        current_streak=current_streak,
        longest_streak=longest_streak,
        avg_score=round(float(avg_score or 0), 1),
        xp_total=xp_total,
        level=level,
        level_label=label,
    )


async def get_dashboard(db: AsyncSession, user: User) -> DashboardResponse:
    metrics = await get_metrics(db, user)
    recent = await _build_recent(db, user.id, limit=20)
    ready = await task_service.ready_task_summaries(db, user_id=user.id)
    if user.onboarding_completed:
        await task_service.enqueue_missing_ready_task_refills(user.id, ready)
    in_progress = [
        rt
        for rt in recent
        if rt.status in ("not_started", "in_progress", "submitted", "processing", "needs_retry", "failed")
    ]
    courses = await db.execute(select(Course).where(Course.is_active.is_(True)).order_by(Course.display_order))
    recommended = [
        CourseOut(
            id=c.slug,
            slug=c.slug,
            type=c.type,  # type: ignore[arg-type]
            title=c.title,
            subtitle=c.subtitle,
            description=c.description,
            min_grade=c.min_grade,
            max_grade=c.max_grade,
            estimated_minutes=c.estimated_minutes,
            illustration=c.illustration,  # type: ignore[arg-type]
        )
        for c in courses.scalars().all()
    ]
    achievements = await get_achievements(db, user)
    achievements_recent = sorted(
        [a for a in achievements if a.earned], key=lambda a: a.earned_at or datetime.min, reverse=True
    )[:6]
    return DashboardResponse(
        greeting=f"Hi {user.first_name}! Ready for today's quest?",
        metrics=metrics,
        in_progress=in_progress,
        recent=recent,
        ready_tasks=ReadyTasks(reading=ready["reading"], writing=ready["writing"]),
        recommended=recommended,
        achievements_recent=achievements_recent,
    )


async def get_achievements(db: AsyncSession, user: User) -> list[AchievementOut]:
    catalog = await db.execute(select(Achievement).order_by(Achievement.display_order))
    earned_q = await db.execute(select(UserAchievement).where(UserAchievement.user_id == user.id))
    earned_by_slug: dict[str, UserAchievement] = {ua.achievement_slug: ua for ua in earned_q.scalars().all()}
    out: list[AchievementOut] = []
    for a in catalog.scalars().all():
        ua = earned_by_slug.get(a.slug)
        out.append(
            AchievementOut(
                id=a.slug,
                slug=a.slug,
                name=a.name,
                description=a.description,
                icon=a.icon,
                earned=ua is not None,
                earned_at=ua.earned_at if ua is not None else None,
            )
        )
    return out


async def list_notifications(db: AsyncSession, user: User, limit: int = 50) -> list[NotificationOut]:
    rows = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return [
        NotificationOut(
            id=n.id,
            kind=n.kind,  # type: ignore[arg-type]
            payload=n.payload,
            read_at=n.read_at,
            created_at=n.created_at,
        )
        for n in rows.scalars().all()
    ]


async def mark_notification_read(db: AsyncSession, user: User, notification_id: uuid.UUID) -> None:
    notif = await db.get(Notification, notification_id)
    if notif is None or notif.user_id != user.id:
        return
    if notif.read_at is None:
        notif.read_at = datetime.now(UTC)
        await db.commit()


async def mark_all_notifications_read(db: AsyncSession, user: User) -> None:
    rows = await db.execute(select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)))
    now = datetime.now(UTC)
    for n in rows.scalars().all():
        n.read_at = now
    await db.commit()
