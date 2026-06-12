"""Helpers shared between conftest fixtures and tests."""

from __future__ import annotations

from typing import Any


# Canned Claude responses used to stub out network calls during tests.
READING_RESPONSE: dict[str, Any] = {
    "title": "A Tiny Trip Around the Sun",
    "paragraphs": [
        "Long ago, people only dreamed of flying to space.",
        "Today, robots and astronauts go there to learn new things.",
        "They visit the Moon, Mars, and the rings of Saturn, then come home with stories to tell.",
    ],
    "questions": [
        {
            "question_type": "multiple_choice",
            "prompt": "What did people do before space travel?",
            "options": [
                "Dreamed about it",
                "Built rockets",
                "Visited Mars",
                "Ignored it",
            ],
            "correct_answer": "Dreamed about it",
            "explanation": "The first paragraph says people dreamed of flying to space.",
            "max_points": 1,
        },
        {
            "question_type": "true_false",
            "prompt": "Astronauts visit the rings of Saturn.",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": "Stated in the third paragraph.",
            "max_points": 1,
        },
        {
            "question_type": "fill_blank",
            "prompt": "Today, robots and astronauts go there to learn new ____.",
            "options": None,
            "correct_answer": "things",
            "explanation": "Last word of the second paragraph.",
            "max_points": 1,
        },
    ],
}


WRITING_PROMPT_RESPONSE: dict[str, Any] = {
    "title": "A Place You Would Love to Visit",
    "prompt": (
        "Write a short answer about a place you would love to visit. "
        "Aim for 50–110 words."
    ),
    "hints": [
        "Mention the place by name",
        "Use at least two adjectives",
        "End with a personal reason",
    ],
    "min_words": 50,
    "max_words": 110,
}


WRITING_EVAL_RESPONSE: dict[str, Any] = {
    "score_overall": 84,
    "score_grammar": 80,
    "score_vocabulary": 86,
    "score_structure": 88,
    "score_relevance": 82,
    "feedback_summary": "Nice work — your structure and topic relevance shine.",
    "feedback_detail": [
        "You picked a vivid place and gave a clear personal reason at the end."
    ],
    "focus_next": ["Past tense for habits", "Adjective variety"],
    "highlights": [
        {"start": 0, "end": 5, "kind": "suggestion", "message": "Try a stronger opener."}
    ],
}
