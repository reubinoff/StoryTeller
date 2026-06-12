"""Test helpers shared across the integration suite."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient


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
    """Sign up a fresh user, return (user_dict, auth_headers)."""
    body = {**DEFAULT_SIGNUP, **overrides}
    resp = await client.post("/auth/signup", json=body)
    assert resp.status_code == 201, resp.text
    payload = resp.json()
    headers = {"Authorization": f"Bearer {payload['access_token']}"}
    return payload["user"], headers


async def set_interests(
    client: AsyncClient, headers: dict[str, str], slugs: list[str]
) -> None:
    resp = await client.put(
        "/me/interests", headers=headers, json={"interest_ids": slugs}
    )
    assert resp.status_code == 200, resp.text
