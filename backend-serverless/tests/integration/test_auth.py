"""Auth router tests."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.api.v1.routers import auth as auth_router
from app.core.security import create_oauth_state
from app.db.models.user import User

SIGNUP_BODY = {
    "first_name": "Maya",
    "last_name": "Patel",
    "email": "maya@example.com",
    "password": "Snowflake42!",
    "year_of_birth": 2017,
}


@pytest.mark.asyncio
async def test_signup_returns_201_with_user_and_access_token(client: AsyncClient) -> None:
    resp = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["expires_in"] > 0
    assert body["access_token"]
    user = body["user"]
    assert user["email"] == "maya@example.com"
    assert user["first_name"] == "Maya"
    assert user["grade_level"] >= 1
    assert user["grade_level"] <= 12
    assert user["interests"] == []
    assert user["status"] == "active"
    assert user["onboarding_completed"] is False
    assert "rt=" in (resp.headers.get("set-cookie") or "")


@pytest.mark.asyncio
async def test_signup_duplicate_email_returns_409(client: AsyncClient) -> None:
    first = await client.post("/auth/signup", json=SIGNUP_BODY)
    assert first.status_code == 201
    again = await client.post("/auth/signup", json={**SIGNUP_BODY, "first_name": "Other"})
    assert again.status_code == 409
    body = again.json()
    assert body["code"] == "email_taken"
    assert again.headers["content-type"].startswith("application/problem+json")


@pytest.mark.asyncio
async def test_signup_invalid_password_returns_422(client: AsyncClient) -> None:
    bad = {**SIGNUP_BODY, "password": "tooshort"}  # < 8 chars + missing digit
    resp = await client.post("/auth/signup", json=bad)
    assert resp.status_code == 422
    body = resp.json()
    assert body["code"] == "validation_error"
    fields = {e["field"] for e in body["errors"]}
    assert "password" in fields


@pytest.mark.asyncio
async def test_signup_year_of_birth_out_of_range_returns_422(client: AsyncClient) -> None:
    bad = {**SIGNUP_BODY, "year_of_birth": 1800}
    resp = await client.post("/auth/signup", json=bad)
    assert resp.status_code == 422
    fields = {e["field"] for e in resp.json()["errors"]}
    assert "year_of_birth" in fields


@pytest.mark.asyncio
async def test_login_happy_path(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post(
        "/auth/login",
        json={"email": SIGNUP_BODY["email"], "password": SIGNUP_BODY["password"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == SIGNUP_BODY["email"]
    assert body["access_token"]


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401_generic(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post(
        "/auth/login",
        json={"email": SIGNUP_BODY["email"], "password": "WrongPass123"},
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401_generic(client: AsyncClient) -> None:
    resp = await client.post(
        "/auth/login", json={"email": "ghost@nope.com", "password": "Password1"}
    )
    assert resp.status_code == 401
    assert resp.json()["code"] == "invalid_credentials"


@pytest.mark.asyncio
async def test_logout_returns_204(client: AsyncClient) -> None:
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_me_without_token_returns_401(client: AsyncClient) -> None:
    resp = await client.get("/me")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_google_exchange_returns_410(client: AsyncClient) -> None:
    resp = await client.post("/auth/google/exchange", json={"code": "anything"})
    assert resp.status_code == 410
    assert resp.json()["code"] == "google_exchange_removed"


@pytest.mark.asyncio
async def test_refresh_with_cookie_returns_new_access(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 200
    new_body = resp.json()
    assert new_body["access_token"]
    assert new_body["expires_in"] > 0


@pytest.mark.asyncio
async def test_refresh_without_cookie_returns_401(client: AsyncClient) -> None:
    client.cookies.clear()
    resp = await client.post("/auth/refresh")
    assert resp.status_code == 401
    assert resp.json()["code"] == "unauthenticated"


@pytest.mark.asyncio
async def test_logout_clears_refresh_cookie(client: AsyncClient) -> None:
    await client.post("/auth/signup", json=SIGNUP_BODY)
    resp = await client.post("/auth/logout")
    assert resp.status_code == 204
    assert "rt=" in (resp.headers.get("set-cookie") or "")
    assert "Max-Age=0" in (resp.headers.get("set-cookie") or "")


async def _mock_google(monkeypatch: pytest.MonkeyPatch, profile: dict[str, object]) -> None:
    async def exchange(code: str) -> dict[str, object]:
        assert code == "code-123"
        return {"id_token": "id-token-123"}

    async def verify(id_token: str) -> dict[str, object]:
        assert id_token == "id-token-123"
        return profile

    monkeypatch.setattr(auth_router, "_exchange_google_code", exchange)
    monkeypatch.setattr(auth_router, "_verify_google_id_token", verify)


@pytest.mark.asyncio
async def test_google_callback_creates_new_user_and_sets_cookie(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-1",
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Gina",
            "family_name": "Google",
            "picture": "https://example.com/avatar.png",
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/courses", intent="signup")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert resp.headers["location"].endswith("/auth/callback?returnTo=%2Fcourses")
    assert "rt=" in (resp.headers.get("set-cookie") or "")

    refresh = await client.post("/auth/refresh")
    token = refresh.json()["access_token"]
    me = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    body = me.json()
    assert body["email"] == "google@example.com"
    assert body["first_name"] == "Gina"
    assert body["email_verified"] is True
    assert body["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_google_callback_links_existing_verified_email(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    existing_id = signup.json()["user"]["id"]
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-2",
            "email": SIGNUP_BODY["email"],
            "email_verified": True,
            "given_name": "Maya",
            "family_name": "Patel",
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307

    refresh = await client.post("/auth/refresh")
    token = refresh.json()["access_token"]
    me = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["id"] == existing_id


@pytest.mark.asyncio
async def test_google_callback_rejects_bad_state(client: AsyncClient) -> None:
    resp = await client.get("/auth/google/callback?code=code-123&state=bad-state")
    assert resp.status_code == 307
    assert "error=invalid_oauth_state" in resp.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_rejects_unverified_email(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-3",
            "email": "unverified@example.com",
            "email_verified": False,
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert "error=google_email_unverified" in resp.headers["location"]


@pytest.mark.asyncio
async def test_google_callback_rejects_suspended_existing_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, db_engine
) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    user_id = uuid.UUID(signup.json()["user"]["id"])
    _engine, sessionmaker = db_engine
    async with sessionmaker() as session:
        user = await session.get(User, user_id)
        assert user is not None
        user.status = "suspended"
        await session.commit()

    await _mock_google(
        monkeypatch,
        {
            "sub": "google-sub-4",
            "email": SIGNUP_BODY["email"],
            "email_verified": True,
            "iss": "https://accounts.google.com",
        },
    )
    state = create_oauth_state(return_to="/dashboard", intent="login")
    resp = await client.get(f"/auth/google/callback?code=code-123&state={state}")
    assert resp.status_code == 307
    assert "error=invalid_credentials" in resp.headers["location"]
