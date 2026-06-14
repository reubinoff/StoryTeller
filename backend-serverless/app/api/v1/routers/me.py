"""Current-user endpoints: /me, /me/interests, /me/password/change, /me/avatar, DELETE /me,
plus dashboard / metrics / achievements / notifications.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Response, status
from sqlalchemy import delete, select

from app.api.v1.schemas.auth import PasswordChangeRequest
from app.api.v1.schemas.common import Page
from app.api.v1.schemas.dashboard import (
    AchievementOut,
    DashboardMetrics,
    DashboardResponse,
    NotificationOut,
)
from app.api.v1.schemas.user import (
    CompleteOnboardingRequest,
    DeleteAccountRequest,
    UpdateInterestsRequest,
    UpdateInterestsResponse,
    UpdateUserRequest,
    UserOut,
)
from app.core.errors import AppError
from app.db.models._helpers import utcnow
from app.db.models.interest import Interest, UserInterest
from app.deps import CurrentUser, DbSession
from app.services import auth_service, dashboard_service
from app.services.user_service import to_user_out

router = APIRouter(prefix="/me", tags=["me"])


async def _replace_interests(
    db: DbSession, current_user: CurrentUser, interest_ids: list[str]
) -> list[str]:
    valid = await db.execute(select(Interest.slug).where(Interest.slug.in_(interest_ids)))
    valid_set = {r[0] for r in valid.all()}
    missing = [slug for slug in interest_ids if slug not in valid_set]
    if missing:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Validation failed",
            detail="Unknown interest slug",
            errors=[{"field": "interest_ids", "message": f"Unknown: {', '.join(missing)}"}],
        )

    await db.execute(delete(UserInterest).where(UserInterest.user_id == current_user.id))
    created_at = utcnow()
    for position, slug in enumerate(interest_ids):
        db.add(
            UserInterest(
                user_id=current_user.id,
                interest_slug=slug,
                created_at=created_at + timedelta(microseconds=position),
            )
        )
    return interest_ids


@router.get("", response_model=UserOut)
async def get_me(current_user: CurrentUser, db: DbSession) -> UserOut:
    return await to_user_out(db, current_user)


@router.patch("", response_model=UserOut)
async def patch_me(body: UpdateUserRequest, current_user: CurrentUser, db: DbSession) -> UserOut:
    payload = body.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return await to_user_out(db, current_user)


@router.put("/interests", response_model=UpdateInterestsResponse)
async def put_interests(
    body: UpdateInterestsRequest, current_user: CurrentUser, db: DbSession
) -> UpdateInterestsResponse:
    await _replace_interests(db, current_user, body.interest_ids)
    await db.commit()
    return UpdateInterestsResponse(interests=body.interest_ids)


@router.put("/onboarding", response_model=UserOut)
async def complete_onboarding(
    body: CompleteOnboardingRequest, current_user: CurrentUser, db: DbSession
) -> UserOut:
    await _replace_interests(db, current_user, body.interest_ids)
    current_user.year_of_birth = body.year_of_birth
    current_user.grade_level = body.grade_level
    current_user.onboarding_completed_at = utcnow()
    await db.commit()
    await db.refresh(current_user)
    return await to_user_out(db, current_user)


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChangeRequest, current_user: CurrentUser, db: DbSession
) -> Response:
    await auth_service.change_password(db, current_user, body.current_password, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/avatar", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def upload_avatar() -> None:
    raise AppError(
        status_code=501, code="not_implemented", title="Avatar upload not implemented in v1"
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    body: DeleteAccountRequest, current_user: CurrentUser, db: DbSession
) -> Response:
    if not body.confirm:
        raise AppError(
            status_code=422,
            code="validation_error",
            title="Confirmation required",
            errors=[{"field": "confirm", "message": "Must be true to delete the account."}],
        )
    current_user.status = "deleted"
    current_user.deleted_at = utcnow()
    current_user.email = f"deleted-{current_user.id}@deleted.invalid"
    current_user.first_name = "Deleted"
    current_user.last_name = "User"
    current_user.phone_number = None
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Dashboard / metrics / achievements / notifications ---


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(current_user: CurrentUser, db: DbSession) -> DashboardResponse:
    return await dashboard_service.get_dashboard(db, current_user)


@router.get("/metrics", response_model=DashboardMetrics)
async def metrics(current_user: CurrentUser, db: DbSession) -> DashboardMetrics:
    return await dashboard_service.get_metrics(db, current_user)


@router.get("/achievements", response_model=list[AchievementOut])
async def achievements(current_user: CurrentUser, db: DbSession) -> list[AchievementOut]:
    return await dashboard_service.get_achievements(db, current_user)


@router.get("/notifications", response_model=Page[NotificationOut])
async def notifications(current_user: CurrentUser, db: DbSession) -> Page[NotificationOut]:
    items = await dashboard_service.list_notifications(db, current_user)
    return Page(items=items, next_cursor=None)


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notification_read(
    notification_id: str, current_user: CurrentUser, db: DbSession
) -> Response:
    try:
        nid = uuid.UUID(notification_id)
    except ValueError as exc:
        raise AppError(status_code=404, code="not_found", title="Notification not found") from exc
    await dashboard_service.mark_notification_read(db, current_user, nid)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_read(current_user: CurrentUser, db: DbSession) -> Response:
    await dashboard_service.mark_all_notifications_read(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
