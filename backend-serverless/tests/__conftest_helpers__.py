"""Helpers shared between conftest fixtures and tests."""

from __future__ import annotations

from typing import Any


# Canned LLM responses used to stub out network calls during tests.
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
        {
            "question_type": "multiple_choice",
            "prompt": "Who goes to space today?",
            "options": [
                "Robots and astronauts",
                "Only birds",
                "Only teachers",
                "No one",
            ],
            "correct_answer": "Robots and astronauts",
            "explanation": "The second paragraph names robots and astronauts.",
            "max_points": 1,
        },
        {
            "question_type": "true_false",
            "prompt": "Robots go to space to learn new things.",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": "The passage says robots and astronauts go there to learn new things.",
            "max_points": 1,
        },
        {
            "question_type": "fill_blank",
            "prompt": "Robots and astronauts go there to learn new ____.",
            "options": None,
            "correct_answer": "things",
            "explanation": "The missing word is from the second paragraph.",
            "max_points": 1,
        },
        {
            "question_type": "multiple_choice",
            "prompt": "Which planet is named in the story?",
            "options": [
                "Mars",
                "Mercury",
                "Neptune",
                "Venus",
            ],
            "correct_answer": "Mars",
            "explanation": "The third paragraph says travelers visit the Moon, Mars, and Saturn.",
            "max_points": 1,
        },
        {
            "question_type": "true_false",
            "prompt": "The travelers come home with stories to tell.",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": "The passage ends by saying they come home with stories to tell.",
            "max_points": 1,
        },
        {
            "question_type": "fill_blank",
            "prompt": "Today, astronauts go there to learn new ____.",
            "options": None,
            "correct_answer": "things",
            "explanation": "The second paragraph uses the word things.",
            "max_points": 1,
        },
        {
            "question_type": "multiple_choice",
            "prompt": "What is the passage mostly about?",
            "options": [
                "Learning from space travel",
                "Cooking dinner",
                "Building a school",
                "Playing in the rain",
            ],
            "correct_answer": "Learning from space travel",
            "explanation": "The passage focuses on space trips and what people learn from them.",
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
