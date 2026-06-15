"""Admin API integration tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.integration._helpers import signup_and_login


@pytest.mark.asyncio
async def test_admin_session_requires_authentication(client: AsyncClient) -> None:
    resp = await client.get("/admin/session")

    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_admin_session_rejects_normal_user(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client, email="learner-admin-denied@example.com")

    resp = await client.get("/admin/session", headers=headers)

    assert resp.status_code == 403
    assert resp.json()["code"] == "admin_required"
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_bootstrap_email_is_promoted_to_protected_admin(client: AsyncClient) -> None:
    user, headers = await signup_and_login(client, email="reubinoff@gmail.com")

    assert user["role"] == "admin"

    resp = await client.get("/admin/session", headers=headers)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "reubinoff@gmail.com"
    assert body["user"]["role"] == "admin"
    assert body["protected_admin"] is True
    assert body["user"]["protected_admin"] is True
    assert resp.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_admin_can_view_overview_and_search_users(client: AsyncClient) -> None:
    _admin, admin_headers = await signup_and_login(client, email="reubinoff@gmail.com")
    learner, _learner_headers = await signup_and_login(
        client,
        email="learner-search@example.com",
        first_name="Lina",
        last_name="Search",
    )

    overview = await client.get("/admin/overview", headers=admin_headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["kpis"]["users_total"] >= 2
    assert overview.json()["range_days"] == 30

    users = await client.get(
        "/admin/users",
        headers=admin_headers,
        params={"query": "lina", "status": "active"},
    )
    assert users.status_code == 200, users.text
    items = users.json()["items"]
    assert [item["id"] for item in items] == [learner["id"]]
    assert items[0]["email"] == "learner-search@example.com"


@pytest.mark.asyncio
async def test_admin_can_promote_active_user_and_audit_is_recorded(
    client: AsyncClient,
) -> None:
    admin, admin_headers = await signup_and_login(client, email="reubinoff@gmail.com")
    learner, _learner_headers = await signup_and_login(
        client, email="promote-me@example.com"
    )

    promoted = await client.patch(
        f"/admin/users/{learner['id']}/admin",
        headers=admin_headers,
        json={"is_admin": True},
    )

    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["role"] == "admin"

    audit = await client.get(
        "/admin/audit",
        headers=admin_headers,
        params={"target_user_id": learner["id"]},
    )
    assert audit.status_code == 200, audit.text
    event = audit.json()["items"][0]
    assert event["actor_user_id"] == admin["id"]
    assert event["target_user_id"] == learner["id"]
    assert event["action"] == "admin_granted"
    assert event["metadata"] == {"from_role": "user", "to_role": "admin"}


@pytest.mark.asyncio
async def test_admin_safety_blocks_self_and_protected_admin_changes(
    client: AsyncClient,
) -> None:
    admin, admin_headers = await signup_and_login(client, email="reubinoff@gmail.com")
    promoted, promoted_headers = await signup_and_login(
        client, email="new-admin@example.com"
    )
    promote = await client.patch(
        f"/admin/users/{promoted['id']}/admin",
        headers=admin_headers,
        json={"is_admin": True},
    )
    assert promote.status_code == 200, promote.text

    self_demote = await client.patch(
        f"/admin/users/{promoted['id']}/admin",
        headers=promoted_headers,
        json={"is_admin": False},
    )
    assert self_demote.status_code == 409
    assert self_demote.json()["code"] == "admin_safety_violation"

    self_suspend = await client.patch(
        f"/admin/users/{promoted['id']}/status",
        headers=promoted_headers,
        json={"status": "suspended"},
    )
    assert self_suspend.status_code == 409
    assert self_suspend.json()["code"] == "admin_safety_violation"

    protected_demote = await client.patch(
        f"/admin/users/{admin['id']}/admin",
        headers=promoted_headers,
        json={"is_admin": False},
    )
    assert protected_demote.status_code == 403
    assert protected_demote.json()["code"] == "protected_admin"

    protected_suspend = await client.patch(
        f"/admin/users/{admin['id']}/status",
        headers=promoted_headers,
        json={"status": "suspended"},
    )
    assert protected_suspend.status_code == 403
    assert protected_suspend.json()["code"] == "protected_admin"


@pytest.mark.asyncio
async def test_admin_user_detail_rejects_invalid_uuid(client: AsyncClient) -> None:
    _admin, admin_headers = await signup_and_login(client, email="reubinoff@gmail.com")

    resp = await client.get("/admin/users/not-a-uuid", headers=admin_headers)

    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"


@pytest.mark.asyncio
async def test_admin_user_detail_returns_404_for_unknown_user(
    client: AsyncClient,
) -> None:
    _admin, admin_headers = await signup_and_login(client, email="reubinoff@gmail.com")

    resp = await client.get(f"/admin/users/{uuid.uuid4()}", headers=admin_headers)

    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"
