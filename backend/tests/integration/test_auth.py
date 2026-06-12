"""Auth router tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


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
async def test_google_exchange_returns_501(client: AsyncClient) -> None:
    resp = await client.post("/auth/google/exchange", json={"code": "anything"})
    assert resp.status_code == 501
    assert resp.json()["code"] == "not_implemented"


@pytest.mark.asyncio
async def test_refresh_with_valid_token_returns_new_access(client: AsyncClient) -> None:
    signup = await client.post("/auth/signup", json=SIGNUP_BODY)
    token = signup.json()["access_token"]
    resp = await client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    new_body = resp.json()
    assert new_body["access_token"]
    assert new_body["expires_in"] > 0
