"""Tests for the deterministic reading-task grading helpers."""

from __future__ import annotations

import pytest

from app.core.grading import is_correct_answer, normalize_answer, reading_xp
from app.services.content_service import content_grade_for_school_grade, writing_word_bounds
from app.services.user_service import derive_grade_level


def test_normalize_answer_lowercases_and_strips() -> None:
    assert normalize_answer("  Hello  ") == "hello"
    assert normalize_answer(None) == ""
    assert normalize_answer(2) == "2"


@pytest.mark.parametrize(
    "options,user,correct,expected",
    [
        (["A", "B", "C"], 0, "A", True),
        (["A", "B", "C"], "A", "A", True),
        (["A", "B", "C"], 1, "A", False),
        (["A", "B", "C"], "wrong", "A", False),
    ],
)
def test_is_correct_multiple_choice(options, user, correct, expected) -> None:
    assert (
        is_correct_answer(
            question_type="multiple_choice",
            correct_answer=correct,
            user_answer=user,
            options=options,
        )
        is expected
    )


def test_is_correct_true_false_text_or_index() -> None:
    options = ["True", "False"]
    assert is_correct_answer(
        question_type="true_false",
        correct_answer="True",
        user_answer="True",
        options=options,
    )
    assert is_correct_answer(
        question_type="true_false",
        correct_answer="True",
        user_answer=0,
        options=options,
    )
    assert not is_correct_answer(
        question_type="true_false",
        correct_answer="True",
        user_answer="False",
        options=options,
    )


def test_is_correct_fill_blank_case_insensitive() -> None:
    assert is_correct_answer(
        question_type="fill_blank",
        correct_answer="things",
        user_answer="  Things  ",
        options=None,
    )
    assert not is_correct_answer(
        question_type="fill_blank",
        correct_answer="things",
        user_answer="stuff",
        options=None,
    )


def test_reading_xp_scales_with_correct() -> None:
    assert reading_xp(0, 5) == 60
    assert reading_xp(5, 5) == 80
    assert reading_xp(0, 0) == 0


def test_derive_grade_level_clamps_to_1_12() -> None:
    # 6-year-old maps to grade 1.
    from datetime import datetime

    yob_for_grade1 = datetime.now().year - 6
    yob_for_grade12 = datetime.now().year - 18
    yob_too_young = datetime.now().year - 4
    yob_too_old = datetime.now().year - 99

    assert derive_grade_level(yob_for_grade1) == 1
    assert derive_grade_level(yob_for_grade12) == 12
    assert derive_grade_level(yob_too_young) == 1
    assert derive_grade_level(yob_too_old) == 12


@pytest.mark.parametrize(
    ("school_grade", "content_grade"),
    [
        (1, 1),
        (2, 1),
        (5, 4),
        (12, 11),
    ],
)
def test_content_grade_for_school_grade_steps_back_for_israeli_english(
    school_grade: int, content_grade: int
) -> None:
    assert content_grade_for_school_grade(school_grade) == content_grade


def test_writing_word_bounds_scale_with_grade() -> None:
    g1_min, g1_max = writing_word_bounds(1)
    g6_min, g6_max = writing_word_bounds(6)
    g12_min, g12_max = writing_word_bounds(12)
    assert g1_max < g6_max < g12_max
    assert g1_min < g12_min
