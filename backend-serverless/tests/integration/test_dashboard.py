"""Dashboard / metrics / achievements / notifications tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.integration._helpers import set_interests, signup_and_login


@pytest.mark.asyncio
async def test_dashboard_for_fresh_user_returns_zero_metrics(client: AsyncClient) -> None:
    user, headers = await signup_and_login(client)
    resp = await client.get("/me/dashboard", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["greeting"].startswith(f"Hi {user['first_name']}")
    assert body["metrics"]["tasks_completed"] == 0
    assert body["metrics"]["xp_total"] == 0
    assert body["metrics"]["avg_score"] == 0
    assert body["in_progress"] == []
    assert body["recent"] == []
    assert {c["id"] for c in body["recommended"]} == {"reading", "writing"}
    # No achievements have been earned yet → empty list.
    assert body["achievements_recent"] == []


@pytest.mark.asyncio
async def test_metrics_aggregates_completed_tasks(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = rolled.json()
    answers = []
    for q in task["reading"]["questions"]:
        if q["question_type"] == "fill_blank":
            answers.append({"question_id": q["id"], "answer": "things"})
        else:
            answers.append({"question_id": q["id"], "answer": 0})
    submit = await client.post(
        f"/tasks/{task['id']}/submit", headers=headers, json={"answers": answers}
    )
    assert submit.status_code == 200

    metrics = await client.get("/me/metrics", headers=headers)
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["tasks_completed"] == 1
    assert body["xp_total"] > 0
    assert body["avg_score"] >= 0


@pytest.mark.asyncio
async def test_dashboard_in_progress_includes_started_reading_task(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    await client.patch(f"/tasks/{task_id}/start", headers=headers)

    dash = await client.get("/me/dashboard", headers=headers)
    assert dash.status_code == 200
    body = dash.json()
    assert len(body["in_progress"]) == 1
    in_progress = body["in_progress"][0]
    assert in_progress["status"] == "in_progress"
    assert in_progress["progress"] is not None
    assert in_progress["progress"]["total"] == 3


@pytest.mark.asyncio
async def test_dashboard_in_progress_includes_needs_retry_task(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = rolled.json()
    answers = [
        {"question_id": q["id"], "answer": "WRONG"} for q in task["reading"]["questions"]
    ]
    submit = await client.post(
        f"/tasks/{task['id']}/submit", headers=headers, json={"answers": answers}
    )
    assert submit.status_code == 200

    dash = await client.get("/me/dashboard", headers=headers)
    assert dash.status_code == 200
    body = dash.json()
    assert body["metrics"]["tasks_completed"] == 0
    assert body["metrics"]["xp_total"] == 0
    assert len(body["in_progress"]) == 1
    retry_task = body["in_progress"][0]
    assert retry_task["status"] == "needs_retry"
    assert retry_task["passed"] is False
    assert retry_task["passing_score"] == 70


@pytest.mark.asyncio
async def test_dashboard_writing_progress_caps_at_one_hundred_percent(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task = rolled.json()
    task_id = task["id"]
    target = task["writing"]["min_words"]
    draft = " ".join(f"word{i}" for i in range(75))
    saved = await client.post(
        f"/tasks/{task_id}/draft",
        headers=headers,
        json={"text": draft},
    )
    assert saved.status_code == 200

    dash = await client.get("/me/dashboard", headers=headers)
    assert dash.status_code == 200
    items = dash.json()["in_progress"]
    item = next(t for t in items if t["id"] == task_id)
    assert item["status"] == "in_progress"
    assert item["progress"] == {
        "current": 75,
        "total": target,
        "percentage": 100,
        "label": f"75 / {target} words",
    }


@pytest.mark.asyncio
async def test_achievements_returns_full_catalog(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.get("/me/achievements", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    # Six seeded achievements per app/seed.py
    assert len(body) == 6
    for a in body:
        assert {"id", "slug", "name", "description", "icon", "earned", "earned_at"} <= a.keys()
        assert a["earned"] is False
        assert a["earned_at"] is None


@pytest.mark.asyncio
async def test_notifications_includes_writing_completion(client: AsyncClient) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    assert submit.status_code == 202
    await run_writing_evaluation(uuid.UUID(task_id))

    notifs = await client.get("/me/notifications", headers=headers)
    assert notifs.status_code == 200
    items = notifs.json()["items"]
    assert len(items) == 1
    notif = items[0]
    assert notif["kind"] == "task_completed"
    assert notif["payload"]["task_id"] == task_id
    assert notif["read_at"] is None


@pytest.mark.asyncio
async def test_mark_all_notifications_read(client: AsyncClient) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    await run_writing_evaluation(uuid.UUID(task_id))

    resp = await client.post("/me/notifications/read-all", headers=headers)
    assert resp.status_code == 204

    notifs = await client.get("/me/notifications", headers=headers)
    items = notifs.json()["items"]
    assert all(n["read_at"] is not None for n in items)


@pytest.mark.asyncio
async def test_mark_all_notifications_read_with_empty_inbox_is_noop(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)

    resp = await client.post("/me/notifications/read-all", headers=headers)
    assert resp.status_code == 204

    notifs = await client.get("/me/notifications", headers=headers)
    assert notifs.status_code == 200
    assert notifs.json()["items"] == []


@pytest.mark.asyncio
async def test_user_cannot_mark_another_users_notification_read(
    client: AsyncClient,
) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user_a, headers_a = await signup_and_login(
        client,
        email="user-a@example.com",
    )
    await set_interests(client, headers_a, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers_a, json={})
    task_id = rolled.json()["id"]
    await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers_a,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    await run_writing_evaluation(uuid.UUID(task_id))
    notifs = await client.get("/me/notifications", headers=headers_a)
    notification = notifs.json()["items"][0]
    assert notification["read_at"] is None

    _user_b, headers_b = await signup_and_login(
        client,
        email="user-b@example.com",
    )
    resp = await client.post(
        f"/me/notifications/{notification['id']}/read",
        headers=headers_b,
    )
    assert resp.status_code == 204

    notifs_after = await client.get("/me/notifications", headers=headers_a)
    assert notifs_after.json()["items"][0]["read_at"] is None
