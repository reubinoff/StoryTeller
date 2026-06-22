"""English level scale helpers."""

from __future__ import annotations

from datetime import UTC, datetime

ENGLISH_LEVEL_MIN = 0
ENGLISH_LEVEL_MAX = 100
PROFESSIONAL_ENGLISH_MIN = 81
PROFESSIONAL_CONTENT_BUCKET = 13

EnglishLevelBand = tuple[int, int, int]

ENGLISH_LEVEL_BANDS: tuple[EnglishLevelBand, ...] = (
    (1, 0, 6),
    (2, 7, 13),
    (3, 14, 20),
    (4, 21, 26),
    (5, 27, 33),
    (6, 34, 40),
    (7, 41, 46),
    (8, 47, 53),
    (9, 54, 60),
    (10, 61, 66),
    (11, 67, 73),
    (12, 74, 80),
)


def derive_grade_level(year_of_birth: int) -> int:
    """Linear: grade = age - 5, clamped 1..12 (PRD section 1.4)."""
    age = datetime.now(UTC).year - year_of_birth
    return max(1, min(12, age - 5))


def _band_for_grade(grade_level: int) -> EnglishLevelBand:
    clamped = max(1, min(12, grade_level))
    return ENGLISH_LEVEL_BANDS[clamped - 1]


def english_level_for_grade(grade_level: int) -> int:
    """Return the midpoint of the grade's 0-80 English level band."""
    _grade, lower, upper = _band_for_grade(grade_level)
    return (lower + upper + 1) // 2


def default_english_level_for_school_grade(school_grade_level: int) -> int:
    """Preserve the previous conservative difficulty default."""
    return english_level_for_grade(max(1, school_grade_level - 1))


def default_english_level_for_year_of_birth(year_of_birth: int) -> int:
    return default_english_level_for_school_grade(derive_grade_level(year_of_birth))


def content_bucket_for_english_level(english_level: int) -> int:
    level = max(ENGLISH_LEVEL_MIN, min(ENGLISH_LEVEL_MAX, english_level))
    if level >= PROFESSIONAL_ENGLISH_MIN:
        return PROFESSIONAL_CONTENT_BUCKET
    for grade, lower, upper in ENGLISH_LEVEL_BANDS:
        if lower <= level <= upper:
            return grade
    return 12


def content_label_for_english_level(english_level: int) -> str:
    bucket = content_bucket_for_english_level(english_level)
    if bucket == PROFESSIONAL_CONTENT_BUCKET:
        return "Professional English"
    return f"Grade {bucket}"


def english_level_band_label(english_level: int) -> str:
    bucket = content_bucket_for_english_level(english_level)
    if bucket == PROFESSIONAL_CONTENT_BUCKET:
        return "Professional English"
    return f"Grade {bucket} English"
