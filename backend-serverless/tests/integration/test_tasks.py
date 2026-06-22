"""Tasks router tests — the heart of the app."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any, NoReturn

import pytest
from httpx import AsyncClient

from tests.__conftest_helpers__ import READING_RESPONSE, WRITING_EVAL_RESPONSE
from tests.integration._helpers import set_interests, signup_and_login


def _year_of_birth_for_school_grade(school_grade: int) -> int:
    return datetime.now(UTC).year - (school_grade + 5)


def _assert_problem_response(resp, *, status_code: int, code: str) -> dict[str, object]:
    assert resp.status_code == status_code, resp.text
    assert resp.headers["content-type"].startswith("application/problem+json")
    body = resp.json()
    assert body["status"] == status_code
    assert body["code"] == code
    return body


@pytest.mark.asyncio
async def test_roll_reading_task_with_empty_cache_calls_claude(
    client: AsyncClient, claude_stub
) -> None:
    from app.services.content_service import content_grade_for_school_grade

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])

    resp = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["course_id"] == "reading"
    assert body["course_type"] == "unseen_text"
    assert body["interest_id"] == "space"
    assert body["status"] == "not_started"
    assert body["grade_level_at_roll"] == _user["grade_level"]
    assert body["reading"] is not None
    assert len(body["reading"]["questions"]) == 10
    # While not_started, questions must NOT include correct_answer
    for q in body["reading"]["questions"]:
        assert "correct_answer" not in q
        assert "explanation" not in q
    assert len(claude_stub.calls) == 1
    prompt = claude_stub.calls[0]["prompt"]
    content_grade = content_grade_for_school_grade(_user["grade_level"])
    assert "Israeli school English learner" in prompt
    assert f"School grade: **{_user['grade_level']}**" in prompt
    assert f"English difficulty grade: **{content_grade}**" in prompt


@pytest.mark.asyncio
async def test_roll_reading_task_reuses_cache_for_second_user(
    client: AsyncClient, claude_stub
) -> None:
    """Second user with same interest+grade re-uses the cached passage from user A."""
    _userA, headersA = await signup_and_login(
        client, email="userA@example.com", year_of_birth=2017
    )
    await set_interests(client, headersA, ["space"])
    rA = await client.post("/courses/reading/tasks", headers=headersA, json={})
    assert rA.status_code == 201
    assert len(claude_stub.calls) == 1

    _userB, headersB = await signup_and_login(
        client, email="userB@example.com", year_of_birth=2017
    )
    await set_interests(client, headersB, ["space"])
    rB = await client.post("/courses/reading/tasks", headers=headersB, json={})
    assert rB.status_code == 201
    # Same cached passage shared across users → no second Claude call.
    assert len(claude_stub.calls) == 1
    assert rA.json()["title"] == rB.json()["title"]


@pytest.mark.asyncio
async def test_roll_reading_task_reuses_adjusted_content_grade_cache(
    client: AsyncClient, claude_stub
) -> None:
    from app.db.models.content import ContentPassage
    from app.db.session import get_sessionmaker
    from app.services.content_service import content_grade_for_school_grade

    school_grade = 5
    content_grade = content_grade_for_school_grade(school_grade)
    _user, headers = await signup_and_login(
        client,
        email="cached-reader@example.com",
        year_of_birth=_year_of_birth_for_school_grade(school_grade),
    )
    await set_interests(client, headers, ["space"])

    sm = get_sessionmaker()
    async with sm() as db:
        db.add(
            ContentPassage(
                interest_slug="space",
                grade_level=content_grade,
                title="Cached Easier Space Story",
                paragraphs=READING_RESPONSE["paragraphs"],
                questions=READING_RESPONSE["questions"],
                word_count=24,
                model="test",
            )
        )
        await db.commit()

    resp = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["grade_level_at_roll"] == school_grade
    assert body["title"] == "Cached Easier Space Story"
    assert len(claude_stub.calls) == 0


@pytest.mark.asyncio
async def test_roll_reading_task_skips_cached_passage_with_too_few_questions(
    client: AsyncClient, claude_stub
) -> None:
    from app.db.models.content import ContentPassage
    from app.db.session import get_sessionmaker
    from app.services.content_service import content_grade_for_school_grade

    school_grade = 5
    content_grade = content_grade_for_school_grade(school_grade)
    _user, headers = await signup_and_login(
        client,
        email="short-cached-reader@example.com",
        year_of_birth=_year_of_birth_for_school_grade(school_grade),
    )
    await set_interests(client, headers, ["space"])

    sm = get_sessionmaker()
    async with sm() as db:
        db.add(
            ContentPassage(
                interest_slug="space",
                grade_level=content_grade,
                title="Short Cached Space Story",
                paragraphs=READING_RESPONSE["paragraphs"],
                questions=READING_RESPONSE["questions"][:3],
                word_count=24,
                model="test",
            )
        )
        await db.commit()

    resp = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == READING_RESPONSE["title"]
    assert len(body["reading"]["questions"]) == 10
    assert len(claude_stub.calls) == 1


@pytest.mark.asyncio
async def test_roll_writing_task_reuses_adjusted_content_grade_cache(
    client: AsyncClient, claude_stub
) -> None:
    from app.db.models.content import WritingPrompt
    from app.db.session import get_sessionmaker
    from app.services.content_service import content_grade_for_school_grade

    school_grade = 5
    content_grade = content_grade_for_school_grade(school_grade)
    _user, headers = await signup_and_login(
        client,
        email="cached-writer@example.com",
        year_of_birth=_year_of_birth_for_school_grade(school_grade),
    )
    await set_interests(client, headers, ["travel"])

    sm = get_sessionmaker()
    async with sm() as db:
        db.add(
            WritingPrompt(
                interest_slug="travel",
                grade_level=content_grade,
                title="Cached Easier Travel Prompt",
                prompt="Write about a trip you would like to take.",
                hints=["Name the place", "Give one reason"],
                min_words=30,
                max_words=80,
                model="test",
            )
        )
        await db.commit()

    resp = await client.post("/courses/writing/tasks", headers=headers, json={})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["grade_level_at_roll"] == school_grade
    assert body["title"] == "Cached Easier Travel Prompt"
    assert body["writing"]["min_words"] == 30
    assert len(claude_stub.calls) == 0


@pytest.mark.asyncio
async def test_same_user_second_roll_resumes_unfinished_task(
    client: AsyncClient, claude_stub
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])

    first = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert first.status_code == 201
    second = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert second.status_code == 201

    assert second.json()["id"] == first.json()["id"]
    assert len(claude_stub.calls) == 1


@pytest.mark.asyncio
async def test_onboarding_enqueues_ready_task_prewarm(
    client: AsyncClient,
    task_prewarm_queue,
) -> None:
    user, headers = await signup_and_login(client)

    resp = await client.put(
        "/me/onboarding",
        headers=headers,
        json={
            "year_of_birth": user["year_of_birth"],
            "grade_level": user["grade_level"],
            "interest_ids": ["space", "travel"],
        },
    )

    assert resp.status_code == 200, resp.text
    user_id = uuid.UUID(user["id"])
    assert task_prewarm_queue.jobs == [(user_id, "reading"), (user_id, "writing")]


@pytest.mark.asyncio
async def test_interest_change_for_onboarded_user_enqueues_ready_task_prewarm(
    client: AsyncClient,
    task_prewarm_queue,
) -> None:
    user, headers = await signup_and_login(client)
    onboarded = await client.put(
        "/me/onboarding",
        headers=headers,
        json={
            "year_of_birth": user["year_of_birth"],
            "grade_level": user["grade_level"],
            "interest_ids": ["space"],
        },
    )
    assert onboarded.status_code == 200, onboarded.text
    task_prewarm_queue.jobs.clear()
    task_prewarm_queue.messages.clear()

    resp = await client.put(
        "/me/interests",
        headers=headers,
        json={"interest_ids": ["travel"]},
    )

    assert resp.status_code == 200, resp.text
    user_id = uuid.UUID(user["id"])
    assert task_prewarm_queue.jobs == [(user_id, "reading"), (user_id, "writing")]


@pytest.mark.asyncio
async def test_task_prewarm_worker_creates_ready_task_idempotently(
    client: AsyncClient,
    claude_stub,
) -> None:
    from app.services.task_prewarm_service import run_task_prewarm

    user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    user_id = uuid.UUID(user["id"])

    await run_task_prewarm(user_id, "reading")
    await run_task_prewarm(user_id, "reading")

    tasks = await client.get(
        "/tasks", headers=headers, params={"course_type": "unseen_text"}
    )
    assert tasks.status_code == 200
    items = tasks.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "not_started"
    assert len(claude_stub.calls) == 1


@pytest.mark.asyncio
async def test_consuming_ready_tasks_enqueues_same_course_refills(
    client: AsyncClient,
    task_prewarm_queue,
) -> None:
    user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space", "travel"])
    user_id = uuid.UUID(user["id"])

    reading = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert reading.status_code == 201
    question_id = reading.json()["reading"]["questions"][0]["id"]
    answered = await client.post(
        f"/tasks/{reading.json()['id']}/answer",
        headers=headers,
        json={"question_id": question_id, "answer": 0},
    )
    assert answered.status_code == 200

    writing = await client.post("/courses/writing/tasks", headers=headers, json={})
    assert writing.status_code == 201
    drafted = await client.post(
        f"/tasks/{writing.json()['id']}/draft",
        headers=headers,
        json={"text": "A small draft"},
    )
    assert drafted.status_code == 200

    assert task_prewarm_queue.jobs == [(user_id, "reading"), (user_id, "writing")]


@pytest.mark.asyncio
async def test_dashboard_returns_ready_tasks_and_enqueues_missing_buffers(
    client: AsyncClient,
    task_prewarm_queue,
) -> None:
    from app.services.task_prewarm_service import run_task_prewarm

    user, headers = await signup_and_login(client)
    onboarded = await client.put(
        "/me/onboarding",
        headers=headers,
        json={
            "year_of_birth": user["year_of_birth"],
            "grade_level": user["grade_level"],
            "interest_ids": ["space", "travel"],
        },
    )
    assert onboarded.status_code == 200, onboarded.text
    task_prewarm_queue.jobs.clear()
    task_prewarm_queue.messages.clear()

    await run_task_prewarm(uuid.UUID(user["id"]), "reading")
    dashboard = await client.get("/me/dashboard", headers=headers)

    assert dashboard.status_code == 200, dashboard.text
    ready_tasks = dashboard.json()["ready_tasks"]
    assert ready_tasks["reading"]["course_id"] == "reading"
    assert ready_tasks["reading"]["status"] == "not_started"
    assert ready_tasks["writing"] is None
    assert task_prewarm_queue.jobs == [(uuid.UUID(user["id"]), "writing")]


@pytest.mark.asyncio
async def test_passing_reading_creates_ready_next_task(
    client: AsyncClient, claude_stub
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])

    first = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = first.json()
    answers = []
    for q in task["reading"]["questions"]:
        if q["question_type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "answer": 0})
        elif q["question_type"] == "true_false":
            answers.append({"question_id": q["id"], "answer": "True"})
        else:
            answers.append({"question_id": q["id"], "answer": "things"})

    submit = await client.post(
        f"/tasks/{task['id']}/submit", headers=headers, json={"answers": answers}
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == "completed"
    assert submit.json()["passed"] is True
    result = await client.get(f"/tasks/{task['id']}/result", headers=headers)
    assert result.status_code == 200
    assert result.json()["next_task"]["course_id"] == "reading"

    next_roll = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert next_roll.status_code == 201
    assert next_roll.json()["id"] != task["id"]
    assert next_roll.json()["status"] == "not_started"
    assert len(claude_stub.calls) == 2


@pytest.mark.asyncio
async def test_roll_with_no_interests_returns_422(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert resp.status_code == 422
    assert resp.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_roll_unknown_interest_returns_422_problem_json(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.post(
        "/courses/reading/tasks",
        headers=headers,
        json={"interest_id": "not-a-real-interest"},
    )

    body = _assert_problem_response(resp, status_code=422, code="validation_error")
    assert body["errors"] == [
        {
            "field": "interest_id",
            "message": "Unknown interest: not-a-real-interest",
        }
    ]


@pytest.mark.asyncio
async def test_roll_unknown_course_returns_404(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    resp = await client.post("/courses/listening/tasks", headers=headers, json={})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unfinished_reading_does_not_block_writing_roll(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space", "travel"])
    reading = await client.post("/courses/reading/tasks", headers=headers, json={})
    writing = await client.post("/courses/writing/tasks", headers=headers, json={})

    assert reading.status_code == 201
    assert writing.status_code == 201
    assert reading.json()["id"] != writing.json()["id"]
    assert writing.json()["course_id"] == "writing"


@pytest.mark.asyncio
async def test_roll_uses_random_interest_when_none_provided(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    resp = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert resp.status_code == 201
    assert resp.json()["interest_id"] == "space"


@pytest.mark.asyncio
async def test_get_task_masks_correct_answer_until_completed(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.status_code == 200
    for q in fetched.json()["reading"]["questions"]:
        assert "correct_answer" not in q
        assert "explanation" not in q


@pytest.mark.asyncio
async def test_get_task_with_invalid_uuid_returns_404_problem_json(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    resp = await client.get("/tasks/not-a-uuid", headers=headers)

    _assert_problem_response(resp, status_code=404, code="not_found")


@pytest.mark.asyncio
async def test_start_task_is_idempotent(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    first = await client.patch(f"/tasks/{task_id}/start", headers=headers)
    assert first.status_code == 200
    body1 = first.json()
    assert body1["status"] == "in_progress"
    started_at1 = body1["started_at"]
    assert started_at1 is not None

    second = await client.patch(f"/tasks/{task_id}/start", headers=headers)
    assert second.status_code == 200
    assert second.json()["started_at"] == started_at1


@pytest.mark.asyncio
async def test_answer_endpoint_does_not_reveal_correctness(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    qid = rolled.json()["reading"]["questions"][0]["id"]

    resp = await client.post(
        f"/tasks/{task_id}/answer",
        headers=headers,
        json={"question_id": qid, "answer": 0},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"accepted": True}


@pytest.mark.asyncio
async def test_wrong_course_mutations_return_invalid_state(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space", "travel"])
    reading = await client.post(
        "/courses/reading/tasks",
        headers=headers,
        json={"interest_id": "space"},
    )
    writing = await client.post(
        "/courses/writing/tasks",
        headers=headers,
        json={"interest_id": "travel"},
    )
    reading_id = reading.json()["id"]
    writing_id = writing.json()["id"]

    draft_reading = await client.post(
        f"/tasks/{reading_id}/draft",
        headers=headers,
        json={"text": "draft"},
    )
    _assert_problem_response(draft_reading, status_code=400, code="invalid_state")

    answer_writing = await client.post(
        f"/tasks/{writing_id}/answer",
        headers=headers,
        json={"question_id": str(uuid.uuid4()), "answer": "Nope"},
    )
    _assert_problem_response(answer_writing, status_code=400, code="invalid_state")

    retry_reading = await client.post(f"/tasks/{reading_id}/retry", headers=headers)
    _assert_problem_response(retry_reading, status_code=400, code="invalid_state")


@pytest.mark.asyncio
async def test_malformed_reading_submit_body_returns_422_problem_json(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    resp = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"answers": [{"question_id": "not-a-uuid", "answer": 0}]},
    )

    body = _assert_problem_response(resp, status_code=422, code="validation_error")
    assert body["errors"][0]["field"] == "answers.0.question_id"


@pytest.mark.asyncio
async def test_malformed_writing_submit_body_returns_422_problem_json(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    resp = await client.post(f"/tasks/{task_id}/submit", headers=headers, json={})

    body = _assert_problem_response(resp, status_code=422, code="validation_error")
    assert body["errors"][0]["field"] == "full_text"


@pytest.mark.asyncio
async def test_submit_reading_scores_and_unmasks_correct_answers(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = rolled.json()
    task_id = task["id"]
    questions = task["reading"]["questions"]

    answers = []
    for q in questions:
        if q["question_type"] == "multiple_choice":
            answers.append({"question_id": q["id"], "answer": 0})
        elif q["question_type"] == "true_false":
            answers.append({"question_id": q["id"], "answer": "True"})
        else:
            answers.append({"question_id": q["id"], "answer": "things"})

    submit = await client.post(
        f"/tasks/{task_id}/submit", headers=headers, json={"answers": answers}
    )
    assert submit.status_code == 200, submit.text
    body = submit.json()
    assert body["status"] == "completed"
    assert body["correct_count"] == 10
    assert body["total"] == 10
    assert body["score"] == 100

    # /result reveals correct answers + explanations.
    result = await client.get(f"/tasks/{task_id}/result", headers=headers)
    assert result.status_code == 200
    rbody = result.json()
    assert rbody["mode"] == "reading"
    assert rbody["score"] == 10
    assert rbody["total"] == 10
    assert rbody["percentage"] == 100
    for q in rbody["questions"]:
        assert q["correct_answer"]
        assert "is_correct" in q
        assert q["is_correct"] is True


@pytest.mark.asyncio
async def test_submit_reading_with_wrong_answers_scores_partially(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = rolled.json()
    answers = [
        {"question_id": q["id"], "answer": "WRONG"} for q in task["reading"]["questions"]
    ]
    submit = await client.post(
        f"/tasks/{task['id']}/submit", headers=headers, json={"answers": answers}
    )
    assert submit.status_code == 200
    body = submit.json()
    assert body["correct_count"] == 0
    assert body["score"] == 0
    assert body["status"] == "needs_retry"
    assert body["passed"] is False
    assert body["xp_awarded"] == 0

    result = await client.get(f"/tasks/{task['id']}/result", headers=headers)
    assert result.status_code == 200
    assert result.json()["passed"] is False

    rolled_again = await client.post("/courses/reading/tasks", headers=headers, json={})
    assert rolled_again.status_code == 201
    assert rolled_again.json()["id"] == task["id"]
    assert rolled_again.json()["status"] == "needs_retry"

    redo = await client.post(f"/tasks/{task['id']}/redo", headers=headers)
    assert redo.status_code == 200
    redo_body = redo.json()
    assert redo_body["status"] == "not_started"
    assert redo_body["score"] is None
    assert redo_body["passed"] is None
    for q in redo_body["reading"]["questions"]:
        assert "correct_answer" not in q
        assert "explanation" not in q


@pytest.mark.asyncio
async def test_get_result_for_in_progress_reading_returns_400(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    resp = await client.get(f"/tasks/{task_id}/result", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == "invalid_state"


@pytest.mark.asyncio
async def test_writing_submit_queues_eval_and_worker_completes(
    client: AsyncClient,
    claude_stub,
    evaluation_queue,
) -> None:
    from app.services.content_service import content_grade_for_school_grade
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    assert rolled.status_code == 201
    task = rolled.json()
    assert task["course_type"] == "short_writing"
    assert task["grade_level_at_roll"] == _user["grade_level"]
    assert task["writing"] is not None
    assert task["writing"]["min_words"] >= 10
    content_grade = content_grade_for_school_grade(_user["grade_level"])
    prompt = claude_stub.calls[0]["prompt"]
    assert "Israeli school English learner" in prompt
    assert f"School grade: **{_user['grade_level']}**" in prompt
    assert f"English difficulty grade: **{content_grade}**" in prompt

    submit = await client.post(
        f"/tasks/{task['id']}/submit",
        headers=headers,
        json={"full_text": "I would love to visit Kyoto, the old capital of Japan."},
    )
    assert submit.status_code == 202
    assert submit.json()["status"] == "processing"
    task_id = uuid.UUID(task["id"])
    assert evaluation_queue.task_ids == [task_id]

    fetched = await client.get(f"/tasks/{task['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "processing"

    await run_writing_evaluation(task_id)

    fetched = await client.get(f"/tasks/{task['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "completed"

    result = await client.get(f"/tasks/{task['id']}/result", headers=headers)
    assert result.status_code == 200
    rbody = result.json()
    assert rbody["mode"] == "writing"
    assert rbody["status"] == "completed"
    assert rbody["evaluation"] is not None
    assert rbody["evaluation"]["score_overall"] == 84
    assert rbody["answer_text"].startswith("I would love")
    assert rbody["next_task"]["course_id"] == "writing"
    eval_prompt = claude_stub.calls[1]["prompt"]
    assert f"School grade: **{_user['grade_level']}**" in eval_prompt
    assert f"English difficulty grade: **{content_grade}**" in eval_prompt


@pytest.mark.asyncio
async def test_completed_writing_rejects_submit_retry_and_redo(
    client: AsyncClient,
) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    assert submit.status_code == 202
    await run_writing_evaluation(uuid.UUID(task_id))

    resubmit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Trying to submit twice."},
    )
    _assert_problem_response(resubmit, status_code=400, code="invalid_state")

    retry = await client.post(f"/tasks/{task_id}/retry", headers=headers)
    _assert_problem_response(retry, status_code=400, code="invalid_state")

    redo = await client.post(f"/tasks/{task_id}/redo", headers=headers)
    _assert_problem_response(redo, status_code=400, code="invalid_state")


@pytest.mark.asyncio
async def test_low_writing_score_needs_retry_and_redo_keeps_draft(
    client: AsyncClient,
    claude_stub,
    evaluation_queue,
) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    answer = "Kyoto is amazing because of bamboo and tea."
    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": answer},
    )
    assert submit.status_code == 202
    assert evaluation_queue.task_ids == [uuid.UUID(task_id)]

    claude_stub.next_response = {
        **WRITING_EVAL_RESPONSE,
        "score_overall": 62,
        "score_grammar": 60,
        "score_vocabulary": 64,
        "score_structure": 62,
        "score_relevance": 63,
    }
    await run_writing_evaluation(uuid.UUID(task_id))

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["status"] == "needs_retry"
    assert body["passed"] is False
    assert body["xp_awarded"] == 0

    rolled_again = await client.post("/courses/writing/tasks", headers=headers, json={})
    assert rolled_again.status_code == 201
    assert rolled_again.json()["id"] == task_id
    assert rolled_again.json()["status"] == "needs_retry"

    result = await client.get(f"/tasks/{task_id}/result", headers=headers)
    assert result.status_code == 200
    assert result.json()["passed"] is False
    assert result.json()["evaluation"]["score_overall"] == 62

    redo = await client.post(f"/tasks/{task_id}/redo", headers=headers)
    assert redo.status_code == 200
    redo_body = redo.json()
    assert redo_body["status"] == "in_progress"
    assert redo_body["score"] is None
    assert redo_body["passed"] is None
    assert redo_body["writing"]["draft"] == answer


@pytest.mark.asyncio
async def test_writing_draft_save_returns_saved_at(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    resp = await client.post(
        f"/tasks/{task_id}/draft",
        headers=headers,
        json={"text": "draft so far"},
    )
    assert resp.status_code == 200
    assert "saved_at" in resp.json()

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.json()["status"] == "in_progress"
    assert fetched.json()["writing"]["draft"] == "draft so far"


@pytest.mark.asyncio
async def test_writing_draft_save_rejects_after_submission_and_results(
    client: AsyncClient,
    claude_stub,
) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    async def roll_and_submit(email: str) -> tuple[dict[str, str], str]:
        _user, headers = await signup_and_login(client, email=email)
        await set_interests(client, headers, ["travel"])
        rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
        task_id = rolled.json()["id"]
        submit = await client.post(
            f"/tasks/{task_id}/submit",
            headers=headers,
            json={"full_text": "Kyoto is amazing because of bamboo and tea."},
        )
        assert submit.status_code == 202
        return headers, task_id

    processing_headers, processing_id = await roll_and_submit("processing@example.com")
    draft_processing = await client.post(
        f"/tasks/{processing_id}/draft",
        headers=processing_headers,
        json={"text": "too late"},
    )
    _assert_problem_response(draft_processing, status_code=400, code="invalid_state")

    await run_writing_evaluation(uuid.UUID(processing_id))
    draft_completed = await client.post(
        f"/tasks/{processing_id}/draft",
        headers=processing_headers,
        json={"text": "too late again"},
    )
    _assert_problem_response(draft_completed, status_code=400, code="invalid_state")

    retry_headers, retry_id = await roll_and_submit("needs-retry@example.com")
    claude_stub.next_response = {
        **WRITING_EVAL_RESPONSE,
        "score_overall": 62,
        "score_grammar": 60,
        "score_vocabulary": 64,
        "score_structure": 62,
        "score_relevance": 63,
    }
    await run_writing_evaluation(uuid.UUID(retry_id))
    draft_retry = await client.post(
        f"/tasks/{retry_id}/draft",
        headers=retry_headers,
        json={"text": "too late after retry result"},
    )
    _assert_problem_response(draft_retry, status_code=400, code="invalid_state")


@pytest.mark.asyncio
async def test_retry_only_works_on_failed_tasks(client: AsyncClient) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    # Fresh writing task is not_started → retry must fail.
    resp = await client.post(f"/tasks/{task_id}/retry", headers=headers)
    assert resp.status_code == 400
    assert resp.json()["code"] == "invalid_state"


@pytest.mark.asyncio
async def test_list_tasks_filters_by_status_and_course_type(
    client: AsyncClient,
) -> None:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space", "travel"])
    r1 = await client.post(
        "/courses/reading/tasks", headers=headers, json={"interest_id": "space"}
    )
    r2 = await client.post(
        "/courses/writing/tasks", headers=headers, json={"interest_id": "travel"}
    )
    assert r1.status_code == 201
    assert r2.status_code == 201

    all_tasks = await client.get("/tasks", headers=headers)
    assert all_tasks.status_code == 200
    assert len(all_tasks.json()["items"]) == 2

    only_writing = await client.get(
        "/tasks", headers=headers, params={"course_type": "short_writing"}
    )
    assert only_writing.status_code == 200
    items = only_writing.json()["items"]
    assert len(items) == 1
    assert items[0]["course_type"] == "short_writing"

    only_not_started = await client.get(
        "/tasks", headers=headers, params={"status": "not_started"}
    )
    assert only_not_started.status_code == 200
    assert {t["status"] for t in only_not_started.json()["items"]} == {"not_started"}


@pytest.mark.asyncio
async def test_submit_uses_answers_recorded_via_answer_endpoint(
    client: AsyncClient,
) -> None:
    """If the client posts answers via /answer one by one and then submits with empty body."""
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headers, json={})
    task = rolled.json()
    questions = task["reading"]["questions"]

    for q in questions:
        if q["question_type"] == "multiple_choice":
            ans: object = 0
        elif q["question_type"] == "true_false":
            ans = "True"
        else:
            ans = "things"
        await client.post(
            f"/tasks/{task['id']}/answer",
            headers=headers,
            json={"question_id": q["id"], "answer": ans},
        )

    submit = await client.post(
        f"/tasks/{task['id']}/submit", headers=headers, json={"answers": []}
    )
    assert submit.status_code == 200
    body = submit.json()
    assert body["correct_count"] == 10


@pytest.mark.asyncio
async def test_writing_result_while_processing_returns_null_evaluation(
    client: AsyncClient,
    evaluation_queue,
) -> None:
    """Result endpoint must return ``evaluation=null`` while still processing."""
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "I love Kyoto so much."},
    )
    assert submit.status_code == 202
    assert evaluation_queue.task_ids == [uuid.UUID(task_id)]

    result = await client.get(f"/tasks/{task_id}/result", headers=headers)
    assert result.status_code == 200
    body = result.json()
    assert body["status"] == "processing"
    assert body["evaluation"] is None
    assert body["answer_text"] == "I love Kyoto so much."


@pytest.mark.asyncio
async def test_writing_submit_marks_failed_when_queue_enqueue_fails(
    client: AsyncClient,
    evaluation_queue,
) -> None:
    from app.services.evaluation_queue import (
        EvaluationQueueError,
        set_evaluation_queue_client,
    )

    class FailingQueue:
        async def enqueue_writing_evaluation(self, task_id: uuid.UUID) -> None:
            raise EvaluationQueueError("queue down")

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    set_evaluation_queue_client(FailingQueue())
    try:
        submit = await client.post(
            f"/tasks/{task_id}/submit",
            headers=headers,
            json={"full_text": "I love Kyoto so much."},
        )
    finally:
        set_evaluation_queue_client(evaluation_queue)

    assert submit.status_code == 503
    assert submit.json()["code"] == "unavailable"

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["status"] == "failed"
    assert fetched.json()["fail_reason"] == "Evaluation queue unavailable"

    result = await client.get(f"/tasks/{task_id}/result", headers=headers)
    assert result.status_code == 200
    assert result.json()["status"] == "failed"
    assert result.json()["fail_reason"] == "Evaluation queue unavailable"

    draft = await client.post(
        f"/tasks/{task_id}/draft",
        headers=headers,
        json={"text": "too late"},
    )
    _assert_problem_response(draft, status_code=400, code="invalid_state")


@pytest.mark.asyncio
async def test_mark_single_notification_read(client: AsyncClient) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]
    await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing."},
    )
    await run_writing_evaluation(uuid.UUID(task_id))

    notifs = await client.get("/me/notifications", headers=headers)
    notif_id = notifs.json()["items"][0]["id"]

    resp = await client.post(
        f"/me/notifications/{notif_id}/read", headers=headers
    )
    assert resp.status_code == 204
    notifs2 = await client.get("/me/notifications", headers=headers)
    assert notifs2.json()["items"][0]["read_at"] is not None


@pytest.mark.asyncio
async def test_writing_eval_marks_failed_when_llm_raises(
    client: AsyncClient, claude_stub
) -> None:
    """If Claude raises during writing eval, task transitions to failed and emits a notification."""
    # Sign up + roll while stub still works:
    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    assert rolled.status_code == 201
    task_id = rolled.json()["id"]

    # Now break the stub so the evaluation call raises.
    async def _boom(
        *,
        prompt: str,
        output_type: type[Any],
        system: str | None = None,
        max_retries: int = 1,
    ) -> NoReturn:
        raise RuntimeError("LLM is grumpy")

    claude_stub.generate_structured = _boom

    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Some answer."},
    )
    assert submit.status_code == 202
    from app.services.evaluation_service import run_writing_evaluation

    await run_writing_evaluation(uuid.UUID(task_id))

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.json()["status"] == "failed"

    notifs = await client.get("/me/notifications", headers=headers)
    kinds = {n["kind"] for n in notifs.json()["items"]}
    assert "task_failed" in kinds


@pytest.mark.asyncio
async def test_duplicate_worker_message_is_idempotent(client: AsyncClient) -> None:
    from sqlalchemy import func, select

    from app.db.models.task_evaluation import TaskEvaluation
    from app.db.session import get_sessionmaker
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = uuid.UUID(rolled.json()["id"])
    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    assert submit.status_code == 202

    await run_writing_evaluation(task_id)
    await run_writing_evaluation(task_id)

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.json()["status"] == "completed"

    writing_tasks = await client.get(
        "/tasks", headers=headers, params={"course_type": "short_writing"}
    )
    assert writing_tasks.status_code == 200
    assert len(writing_tasks.json()["items"]) == 2
    assert sum(1 for t in writing_tasks.json()["items"] if t["status"] == "not_started") == 1

    sm = get_sessionmaker()
    async with sm() as db:
        count = await db.scalar(
            select(func.count()).select_from(TaskEvaluation).where(
                TaskEvaluation.task_id == task_id
            )
        )
    assert count == 1


@pytest.mark.asyncio
async def test_concurrent_duplicate_worker_messages_are_idempotent(
    client: AsyncClient,
) -> None:
    from sqlalchemy import func, select

    from app.db.models.task_evaluation import TaskEvaluation
    from app.db.session import get_sessionmaker
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = uuid.UUID(rolled.json()["id"])
    submit = await client.post(
        f"/tasks/{task_id}/submit",
        headers=headers,
        json={"full_text": "Kyoto is amazing because of bamboo and tea."},
    )
    assert submit.status_code == 202

    await asyncio.gather(
        run_writing_evaluation(task_id),
        run_writing_evaluation(task_id),
    )

    fetched = await client.get(f"/tasks/{task_id}", headers=headers)
    assert fetched.json()["status"] == "completed"

    sm = get_sessionmaker()
    async with sm() as db:
        count = await db.scalar(
            select(func.count()).select_from(TaskEvaluation).where(
                TaskEvaluation.task_id == task_id
            )
        )
    assert count == 1


@pytest.mark.asyncio
async def test_worker_ignores_stale_task_id(db_engine) -> None:  # noqa: ARG001
    from app.services.evaluation_service import run_writing_evaluation

    await run_writing_evaluation(uuid.uuid4())


@pytest.mark.asyncio
async def test_retry_after_failure_triggers_re_evaluation(
    client: AsyncClient,
    claude_stub,
    evaluation_queue,
) -> None:
    from app.services.evaluation_service import run_writing_evaluation

    _user, headers = await signup_and_login(client)
    await set_interests(client, headers, ["travel"])
    rolled = await client.post("/courses/writing/tasks", headers=headers, json={})
    task_id = rolled.json()["id"]

    original_generate_structured = claude_stub.generate_structured

    async def _boom(
        *,
        prompt: str,
        output_type: type[Any],
        system: str | None = None,
        max_retries: int = 1,
    ) -> NoReturn:
        raise RuntimeError("LLM is still grumpy")

    claude_stub.generate_structured = _boom
    try:
        await client.post(
            f"/tasks/{task_id}/submit",
            headers=headers,
            json={"full_text": "An answer."},
        )
        await run_writing_evaluation(uuid.UUID(task_id))
        first = await client.get(f"/tasks/{task_id}", headers=headers)
        assert first.json()["status"] == "failed"

        claude_stub.generate_structured = original_generate_structured
        retried = await client.post(f"/tasks/{task_id}/retry", headers=headers)
        assert retried.status_code == 202
        assert evaluation_queue.task_ids == [uuid.UUID(task_id), uuid.UUID(task_id)]

        await run_writing_evaluation(uuid.UUID(task_id))
        final = await client.get(f"/tasks/{task_id}", headers=headers)
        assert final.json()["status"] == "completed"
    finally:
        claude_stub.generate_structured = original_generate_structured


@pytest.mark.asyncio
async def test_other_user_cannot_access_my_task(client: AsyncClient) -> None:
    _userA, headersA = await signup_and_login(
        client, email="userA@example.com", year_of_birth=2017
    )
    await set_interests(client, headersA, ["space"])
    rolled = await client.post("/courses/reading/tasks", headers=headersA, json={})
    task_id = rolled.json()["id"]

    _userB, headersB = await signup_and_login(
        client, email="userB@example.com", year_of_birth=2017
    )
    fetched = await client.get(f"/tasks/{task_id}", headers=headersB)
    assert fetched.status_code == 404
