"""Ready-task prewarm worker logic."""

from __future__ import annotations

import logging
import uuid

from app.core.errors import AppError
from app.db.session import get_sessionmaker
from app.services import task_service
from app.services.task_prewarm_queue import TaskPrewarmCourseId

LOGGER = logging.getLogger(__name__)


async def run_task_prewarm(user_id: uuid.UUID, course_id: TaskPrewarmCourseId) -> None:
    """Queue worker entrypoint: ensures one ready task exists for a course."""
    sm = get_sessionmaker()
    async with sm() as db:
        try:
            await task_service.ensure_ready_task_for_course(
                db,
                user_id=user_id,
                course_slug=course_id,
            )
        except AppError as exc:
            if exc.status_code in (404, 422):
                LOGGER.warning(
                    "task_prewarm skipped user_id=%s course_id=%s code=%s",
                    user_id,
                    course_id,
                    exc.code,
                )
                return
            LOGGER.exception(
                "task_prewarm failed user_id=%s course_id=%s",
                user_id,
                course_id,
            )
            raise
        except Exception:
            LOGGER.exception(
                "task_prewarm failed user_id=%s course_id=%s",
                user_id,
                course_id,
            )
            raise
