"""Idempotent seeder for the static catalog: interests, courses, achievements.

The 15 interests must match the IDs the client uses in
``client/app/lib/topics.ts`` and the ``InterestId`` union in
``client/app/lib/api/types.ts``.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Achievement, Course, Interest
from app.db.session import get_sessionmaker


INTERESTS: list[dict[str, object]] = [
    {"slug": "animals", "display_name": "Animals & Pets", "emoji": "🐾", "display_order": 1},
    {"slug": "sports", "display_name": "Sports", "emoji": "⚽", "display_order": 2},
    {"slug": "music", "display_name": "Music", "emoji": "🎵", "display_order": 3},
    {"slug": "movies", "display_name": "Movies & TV", "emoji": "🎬", "display_order": 4},
    {"slug": "science", "display_name": "Science & Nature", "emoji": "🌿", "display_order": 5},
    {"slug": "space", "display_name": "Space & Astronomy", "emoji": "🚀", "display_order": 6},
    {"slug": "tech", "display_name": "Tech & Gadgets", "emoji": "💻", "display_order": 7},
    {"slug": "food", "display_name": "Food & Cooking", "emoji": "🍳", "display_order": 8},
    {"slug": "travel", "display_name": "Travel & Cultures", "emoji": "🌍", "display_order": 9},
    {"slug": "art", "display_name": "Art & Drawing", "emoji": "🎨", "display_order": 10},
    {"slug": "books", "display_name": "Books & Stories", "emoji": "📖", "display_order": 11},
    {"slug": "games", "display_name": "Video Games", "emoji": "🎮", "display_order": 12},
    {"slug": "history", "display_name": "History", "emoji": "⏳", "display_order": 13},
    {"slug": "cars", "display_name": "Cars & Vehicles", "emoji": "🚗", "display_order": 14},
    {"slug": "health", "display_name": "Health & Wellness", "emoji": "💚", "display_order": 15},
]


COURSES: list[dict[str, object]] = [
    {
        "slug": "reading",
        "type": "unseen_text",
        "title": "Reading Adventure",
        "subtitle": "Unseen Text",
        "description": (
            "Read a short passage on a topic you love, then answer questions to lock in what you "
            "learned. Instant score, full breakdown."
        ),
        "min_grade": 1,
        "max_grade": 12,
        "estimated_minutes": 5,
        "illustration": "reading",
        "display_order": 1,
    },
    {
        "slug": "writing",
        "type": "short_writing",
        "title": "Writing Studio",
        "subtitle": "Short-Answer Writing",
        "description": (
            "Get a thoughtful prompt, write 60–120 words, and we'll send back a detailed "
            "breakdown of grammar, vocabulary, structure, and topic relevance."
        ),
        "min_grade": 1,
        "max_grade": 12,
        "estimated_minutes": 10,
        "illustration": "writing",
        "display_order": 2,
    },
]


ACHIEVEMENTS: list[dict[str, object]] = [
    {
        "slug": "first_quest",
        "name": "First Quest",
        "description": "Completed your first task",
        "icon": "🎯",
        "display_order": 1,
    },
    {
        "slug": "bookworm",
        "name": "Bookworm",
        "description": "7-day streak",
        "icon": "🔥",
        "display_order": 2,
    },
    {
        "slug": "bullseye",
        "name": "Bullseye",
        "description": "A perfect 100% score",
        "icon": "🎯",
        "display_order": 3,
    },
    {
        "slug": "page_turner",
        "name": "Page-Turner",
        "description": "Finished 10 reading tasks",
        "icon": "📖",
        "display_order": 4,
    },
    {
        "slug": "wordsmith",
        "name": "Wordsmith",
        "description": "Submitted 5 writing tasks",
        "icon": "✍️",
        "display_order": 5,
    },
    {
        "slug": "marathoner",
        "name": "Marathoner",
        "description": "30-day streak",
        "icon": "🏆",
        "display_order": 6,
    },
]


async def seed_static_catalog(session: AsyncSession | None = None) -> None:
    """Insert any missing interests/courses/achievements. Idempotent."""
    own = session is None
    if own:
        sm = get_sessionmaker()
        session = sm()
    assert session is not None
    try:
        await _seed_table(session, Interest, "slug", INTERESTS)
        await _seed_table(session, Course, "slug", COURSES)
        await _seed_table(session, Achievement, "slug", ACHIEVEMENTS)
        await session.commit()
    finally:
        if own:
            await session.close()


async def _seed_table(
    session: AsyncSession,
    model: type,
    pk_field: str,
    rows: list[dict[str, object]],
) -> None:
    pk = getattr(model, pk_field)
    existing = await session.execute(select(pk))
    existing_ids = {r[0] for r in existing.all()}
    for row in rows:
        if row[pk_field] in existing_ids:
            continue
        session.add(model(**row))
