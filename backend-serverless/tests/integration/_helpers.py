"""Test helpers shared across the integration suite."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

from app.core.session_cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE


DEFAULT_SIGNUP = {
    "first_name": "Maya",
    "last_name": "Patel",
    "email": "maya@example.com",
    "password": "Snowflake42!",
    "year_of_birth": 2017,
}


async def signup_and_login(
    client: AsyncClient, **overrides: Any
) -> tuple[dict[str, Any], dict[str, str]]:
    """Sign up a fresh user, return (user_dict, cookie + CSRF auth headers)."""
    body = {**DEFAULT_SIGNUP, **overrides}
    resp = await client.post("/auth/signup", json=body)
    assert resp.status_code == 201, resp.text
    payload = resp.json()
    access_cookie = resp.cookies.get(ACCESS_COOKIE)
    refresh_cookie = resp.cookies.get(REFRESH_COOKIE)
    csrf_cookie = resp.cookies.get(CSRF_COOKIE)
    assert access_cookie
    assert refresh_cookie
    assert csrf_cookie
    headers = {
        "Cookie": (
            f"{ACCESS_COOKIE}={access_cookie}; "
            f"{REFRESH_COOKIE}={refresh_cookie}; "
            f"{CSRF_COOKIE}={csrf_cookie}"
        ),
        "X-CSRF-Token": csrf_cookie,
    }
    return payload["user"], headers


async def set_interests(
    client: AsyncClient, headers: dict[str, str], slugs: list[str]
) -> None:
    resp = await client.put(
        "/me/interests", headers=headers, json={"interest_ids": slugs}
    )
    assert resp.status_code == 200, resp.text
