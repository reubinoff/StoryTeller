"""/me router tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.integration._helpers import signup_and_login


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
    _user, headers = await signup_and_login(client)
    resp = await client.put(
        "/me/onboarding",
        headers=headers,
        json={"year_of_birth": 2012, "grade_level": 4, "interest_ids": ["space", "animals"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["year_of_birth"] == 2012
    assert body["grade_level"] == 4
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
