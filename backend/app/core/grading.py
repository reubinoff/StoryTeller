"""Deterministic scoring for reading tasks."""

from __future__ import annotations


def normalize_answer(value: str | int | None) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def is_correct_answer(
    *,
    question_type: str,
    correct_answer: str,
    user_answer: str | int | None,
    options: list[str] | None,
) -> bool:
    """Compare a user's answer to the stored correct answer.

    Reading multiple_choice / true_false: client may send the option's index OR the option text.
    Fill-blank: case-insensitive trimmed string match against the canonical answer.
    """
    if user_answer is None:
        return False
    user = normalize_answer(user_answer)
    correct = normalize_answer(correct_answer)
    if not user:
        return False

    if question_type == "fill_blank":
        return user == correct

    # MC and true/false: accept either the option text or the integer index.
    if isinstance(user_answer, int) or (isinstance(user_answer, str) and user_answer.isdigit()):
        idx = int(user_answer)
        if options and 0 <= idx < len(options):
            if normalize_answer(options[idx]) == correct:
                return True
    return user == correct


def reading_xp(correct: int, total: int) -> int:
    """Reward formula matches the mock (60 base + 4 per correct)."""
    if total == 0:
        return 0
    return 60 + correct * 4
