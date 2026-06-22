"""/me router tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.core.session_cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.db.models.user import User
from tests.integration._helpers import set_interests, signup_and_login


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Cookie": f"{ACCESS_COOKIE}=not-a-jwt"},
    ],
)
@pytest.mark.asyncio
async def test_get_me_rejects_missing_or_invalid_access_cookie(
    client: AsyncClient, headers: dict[str, str]
) -> None:
    client.cookies.clear()
    resp = await client.get("/me", headers=headers)
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_get_me_returns_full_user(client: AsyncClient) -> None:
    user, headers = await signup_and_login(client)
    resp = await client.get("/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == user["email"]
    assert body["interests"] == []
    expected_keys = {
        "id",
        "email",
        "email_verified",
        "first_name",
        "last_name",
        "year_of_birth",
        "grade_level",
        "english_level",
        "phone_number",
        "avatar_url",
        "display_locale",
        "theme_preference",
        "text_size_preference",
        "reduce_motion",
        "notif_email_enabled",
        "notif_inapp_enabled",
        "interests",
        "role",
        "status",
        "created_at",
        "onboarding_completed",
    }
    assert expected_keys.issubset(body.keys())
    assert body["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_get_me_rejects_inactive_user(
    client: AsyncClient, db_engine
) -> None:
    user, headers = await signup_and_login(client)
    user_id = uuid.UUID(user["id"])
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        db_user = await session.get(User, user_id)
        assert db_user is not None
        db_user.status = "suspended"
        await session.commit()

    resp = await client.get("/me", headers=headers)
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_patch_me_updates_preferences(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.patch(
        "/me",
        headers=headers,
        json={
            "theme_preference": "dark",
            "text_size_preference": "lg",
            "reduce_motion": True,
            "notif_email_enabled": False,
            "phone_number": "+15551234",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["theme_preference"] == "dark"
    assert body["text_size_preference"] == "lg"
    assert body["reduce_motion"] is True
    assert body["notif_email_enabled"] is False
    assert body["phone_number"] == "+15551234"


@pytest.mark.asyncio
async def test_patch_me_updates_english_level_and_refreshes_ready_tasks(
    client: AsyncClient, task_prewarm_queue
) -> None:
    _user, headers = await signup_and_login(client)
    onboarded = await client.put(
        "/me/onboarding",
        headers=headers,
        json={"interest_ids": ["space", "travel"]},
    )
    assert onboarded.status_code == 200, onboarded.text
    task_prewarm_queue.jobs.clear()

    reading = await client.post(
        "/courses/reading/tasks",
        headers=headers,
        json={"interest_id": "space"},
    )
    assert reading.status_code == 201, reading.text
    reading_id = reading.json()["id"]
    started = await client.patch(f"/tasks/{reading_id}/start", headers=headers)
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_progress"

    writing = await client.post(
        "/courses/writing/tasks",
        headers=headers,
        json={"interest_id": "travel"},
    )
    assert writing.status_code == 201, writing.text
    writing_id = writing.json()["id"]
    task_prewarm_queue.jobs.clear()

    resp = await client.patch("/me", headers=headers, json={"english_level": 12})
    assert resp.status_code == 200, resp.text
    assert resp.json()["english_level"] == 12

    kept = await client.get(f"/tasks/{reading_id}", headers=headers)
    assert kept.status_code == 200
    assert kept.json()["status"] == "in_progress"

    deleted = await client.get(f"/tasks/{writing_id}", headers=headers)
    assert deleted.status_code == 404
    assert task_prewarm_queue.jobs == [
        (uuid.UUID(onboarded.json()["id"]), "reading"),
        (uuid.UUID(onboarded.json()["id"]), "writing"),
    ]


@pytest.mark.asyncio
async def test_patch_me_rejects_english_level_out_of_range(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.patch("/me", headers=headers, json={"english_level": 101})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_me_keeps_auto_light_and_dark_preferences(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    for preference in ("auto", "light", "dark"):
        resp = await client.patch(
            "/me",
            headers=headers,
            json={"theme_preference": preference},
        )
        assert resp.status_code == 200
        assert resp.json()["theme_preference"] == preference


@pytest.mark.asyncio
async def test_unsafe_me_routes_require_csrf_header(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    cookie_only_headers = {"Cookie": headers["Cookie"]}
    resp = await client.patch(
        "/me",
        headers=cookie_only_headers,
        json={"first_name": "Maya"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "csrf_mismatch"

    bad_csrf_headers = {
        "Cookie": headers["Cookie"],
        "X-CSRF-Token": "not-the-token",
    }
    resp = await client.patch(
        "/me",
        headers=bad_csrf_headers,
        json={"first_name": "Maya"},
    )
    assert resp.status_code == 403
    assert resp.json()["code"] == "csrf_mismatch"


@pytest.mark.asyncio
async def test_put_interests_replaces_selection(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.put(
        "/me/interests",
        headers=headers,
        json={"interest_ids": ["space", "animals", "tech"]},
    )
    assert resp.status_code == 200
    assert resp.json()["interests"] == ["space", "animals", "tech"]
    me = await client.get("/me", headers=headers)
    assert me.json()["interests"] == ["space", "animals", "tech"]


@pytest.mark.asyncio
async def test_put_interests_removes_only_current_users_dropped_interest_tasks(
    client: AsyncClient,
) -> None:
    _user_a, headers_a = await signup_and_login(client, email="user-a@example.com")
    await set_interests(client, headers_a, ["space", "travel"])

    space = await client.post(
        "/courses/reading/tasks",
        headers=headers_a,
        json={"interest_id": "space"},
    )
    assert space.status_code == 201, space.text
    space_task = space.json()
    answers = []
    for question in space_task["reading"]["questions"]:
        if question["question_type"] == "multiple_choice":
            answers.append({"question_id": question["id"], "answer": 0})
        elif question["question_type"] == "true_false":
            answers.append({"question_id": question["id"], "answer": "True"})
        else:
            answers.append({"question_id": question["id"], "answer": "things"})
    submitted = await client.post(
        f"/tasks/{space_task['id']}/submit",
        headers=headers_a,
        json={"answers": answers},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "completed"

    travel = await client.post(
        "/courses/writing/tasks",
        headers=headers_a,
        json={"interest_id": "travel"},
    )
    assert travel.status_code == 201, travel.text
    travel_task_id = travel.json()["id"]

    _user_b, headers_b = await signup_and_login(client, email="user-b@example.com")
    await set_interests(client, headers_b, ["space"])
    other_user_space = await client.post(
        "/courses/reading/tasks",
        headers=headers_b,
        json={"interest_id": "space"},
    )
    assert other_user_space.status_code == 201, other_user_space.text
    other_user_space_task_id = other_user_space.json()["id"]

    resp = await client.put(
        "/me/interests",
        headers=headers_a,
        json={"interest_ids": ["travel"]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"interests": ["travel"]}

    deleted = await client.get(f"/tasks/{space_task['id']}", headers=headers_a)
    assert deleted.status_code == 404

    kept = await client.get(f"/tasks/{travel_task_id}", headers=headers_a)
    assert kept.status_code == 200
    assert kept.json()["interest_id"] == "travel"

    other_kept = await client.get(
        f"/tasks/{other_user_space_task_id}", headers=headers_b
    )
    assert other_kept.status_code == 200
    assert other_kept.json()["interest_id"] == "space"

    tasks = await client.get("/tasks", headers=headers_a)
    assert tasks.status_code == 200
    items = tasks.json()["items"]
    assert all(item["interest_id"] != "space" for item in items)
    assert any(item["id"] == travel_task_id for item in items)

    metrics = await client.get("/me/metrics", headers=headers_a)
    assert metrics.status_code == 200
    assert metrics.json()["tasks_completed"] == 0


@pytest.mark.asyncio
async def test_put_interests_rejects_more_than_six(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.put(
        "/me/interests",
        headers=headers,
        json={"interest_ids": ["space", "animals", "tech", "food", "art", "books", "travel"]},
    )
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_put_interests_rejects_empty(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.put("/me/interests", headers=headers, json={"interest_ids": []})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_interests_unknown_slug_returns_422(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.put(
        "/me/interests",
        headers=headers,
        json={"interest_ids": ["space", "totally_made_up"]},
    )
    assert resp.status_code == 422
    fields = {e["field"] for e in resp.json().get("errors", [])}
    assert "interest_ids" in fields


@pytest.mark.asyncio
async def test_complete_onboarding_updates_profile_and_interests(
    client: AsyncClient,
) -> None:
    user, headers = await signup_and_login(client)
    resp = await client.put(
        "/me/onboarding",
        headers=headers,
        json={"year_of_birth": 2012, "grade_level": 4, "interest_ids": ["space", "animals"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["year_of_birth"] == user["year_of_birth"]
    assert body["grade_level"] == user["grade_level"]
    assert body["english_level"] == user["english_level"]
    assert body["interests"] == ["space", "animals"]
    assert body["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_delete_me_soft_deletes_and_blocks_future_calls(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.request("DELETE", "/me", headers=headers, json={"confirm": True})
    assert resp.status_code == 204

    follow_up = await client.get("/me", headers=headers)
    assert follow_up.status_code == 401
    assert follow_up.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_delete_me_blocks_refresh_with_existing_cookie(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.request("DELETE", "/me", headers=headers, json={"confirm": True})
    assert resp.status_code == 204

    refresh = await client.post("/auth/refresh")
    assert refresh.status_code == 401
    assert refresh.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_delete_me_requires_confirm_true(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.request("DELETE", "/me", headers=headers, json={"confirm": False})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_password_change_revokes_old_password(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.post(
        "/me/password/change",
        headers=headers,
        json={"current_password": "Snowflake42!", "new_password": "Different7Pass"},
    )
    assert resp.status_code == 204

    re_login = await client.post(
        "/auth/login",
        json={"email": "maya@example.com", "password": "Different7Pass"},
    )
    assert re_login.status_code == 200

    re_login_old = await client.post(
        "/auth/login",
        json={"email": "maya@example.com", "password": "Snowflake42!"},
    )
    assert re_login_old.status_code == 401
