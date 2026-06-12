"""Catalog router tests."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_interests_returns_all_15_in_display_order(client: AsyncClient) -> None:
    resp = await client.get("/interests")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 15
    expected = [
        "animals", "sports", "music", "movies", "science", "space", "tech",
        "food", "travel", "art", "books", "games", "history", "cars", "health",
    ]
    assert [i["id"] for i in items] == expected
    for i in items:
        assert {"id", "display_name", "emoji", "display_order"} <= i.keys()


@pytest.mark.asyncio
async def test_courses_returns_two_courses(client: AsyncClient) -> None:
    resp = await client.get("/courses")
    assert resp.status_code == 200
    items = resp.json()
    assert {c["id"] for c in items} == {"reading", "writing"}
    for c in items:
        assert {
            "id", "slug", "type", "title", "subtitle", "description",
            "min_grade", "max_grade", "estimated_minutes", "illustration",
        } <= c.keys()


@pytest.mark.asyncio
async def test_course_by_id_returns_course(client: AsyncClient) -> None:
    resp = await client.get("/courses/reading")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "reading"
    assert body["type"] == "unseen_text"


@pytest.mark.asyncio
async def test_course_by_unknown_id_returns_404(client: AsyncClient) -> None:
    resp = await client.get("/courses/listening")
    assert resp.status_code == 404
    assert resp.json()["code"] == "not_found"
