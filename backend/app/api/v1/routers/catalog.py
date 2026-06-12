"""Catalog endpoints: /interests, /courses, /courses/{id}."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter

from app.api.v1.schemas.catalog import CourseOut, InterestOut
from app.core.errors import AppError
from app.db.models.course import Course
from app.db.models.interest import Interest
from app.deps import DbSession

router = APIRouter(tags=["catalog"])


@router.get("/interests", response_model=list[InterestOut])
async def list_interests(db: DbSession) -> list[InterestOut]:
    rows = await db.execute(
        select(Interest).where(Interest.is_active.is_(True)).order_by(Interest.display_order)
    )
    return [
        InterestOut(
            id=i.slug,
            display_name=i.display_name,
            emoji=i.emoji,
            display_order=i.display_order,
        )
        for i in rows.scalars().all()
    ]


def _course_to_out(c: Course) -> CourseOut:
    return CourseOut(
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


async def _load_courses(db: AsyncSession) -> list[Course]:
    rows = await db.execute(
        select(Course).where(Course.is_active.is_(True)).order_by(Course.display_order)
    )
    return list(rows.scalars().all())


@router.get("/courses", response_model=list[CourseOut])
async def list_courses(db: DbSession) -> list[CourseOut]:
    return [_course_to_out(c) for c in await _load_courses(db)]


@router.get("/courses/{course_id}", response_model=CourseOut)
async def get_course(course_id: str, db: DbSession) -> CourseOut:
    course = await db.get(Course, course_id)
    if course is None or not course.is_active:
        raise AppError(status_code=404, code="not_found", title="Course not found")
    return _course_to_out(course)
