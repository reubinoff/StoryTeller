import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AuthResponse,
  InterestId,
  Page,
  Task,
  WritingSubmitAccepted,
} from "../../types";
import { commit, getState, reset } from "../db";
import { handleAuth } from "../handlers/auth";
import { handleMe } from "../handlers/me";
import { handleTasks } from "../handlers/tasks";
import type { MockRequest, MockResponse } from "../router";

function req(
  method: MockRequest["method"],
  url: string,
  body?: unknown,
  token: string | null = null
): MockRequest {
  return { method, url, body, token };
}

function data<T>(res: MockResponse<unknown> | null): T {
  if (!res || res.kind !== "ok") throw new Error("Expected ok response");
  return res.data as T;
}

function problem(res: MockResponse<unknown> | null) {
  if (!res || res.kind !== "error") throw new Error("Expected error response");
  return res.problem;
}

function createUser(email: string, interests: InterestId[] = []) {
  const auth = data<AuthResponse>(
    handleAuth(
      req("POST", "/auth/signup", {
        first_name: "Maya",
        last_name: "Patel",
        email,
        password: "Snowflake42",
        year_of_birth: 2017,
      })
    )
  );
  if (interests.length > 0) {
    data(
      handleMe(
        req("PUT", "/me/interests", { interest_ids: interests }, auth.access_token)
      )
    );
  }
  return auth;
}

function roll(token: string, courseId: "reading" | "writing", body: unknown = {}) {
  return data<Task>(
    handleTasks(req("POST", `/courses/${courseId}/tasks`, body, token))
  );
}

beforeEach(() => {
  reset();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("mock task handler contract", () => {
  it("requires auth for task detail routes", () => {
    const res = handleTasks(req("GET", "/tasks/missing"));

    expect(problem(res)).toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
  });

  it("returns 422 when rolling without selected interests", () => {
    const auth = createUser("empty@example.com");

    const res = handleTasks(req("POST", "/courses/reading/tasks", {}, auth.access_token));

    expect(problem(res)).toMatchObject({
      status: 422,
      code: "validation_error",
    });
  });

  it("returns 422 for unknown roll interest ids", () => {
    const auth = createUser("reader@example.com", ["space"]);

    const res = handleTasks(
      req("POST", "/courses/reading/tasks", { interest_id: "unknown" }, auth.access_token)
    );

    expect(problem(res)).toMatchObject({
      status: 422,
      code: "validation_error",
    });
  });

  it("hides another user's task as not found", () => {
    const owner = createUser("owner@example.com", ["space"]);
    const task = roll(owner.access_token, "reading");
    const other = createUser("other@example.com", ["space"]);

    const res = handleTasks(req("GET", `/tasks/${task.id}`, undefined, other.access_token));

    expect(problem(res)).toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("filters task lists by course_type and limit", () => {
    const auth = createUser("mixed@example.com", ["space"]);
    roll(auth.access_token, "reading");
    roll(auth.access_token, "writing");

    const res = handleTasks(
      req("GET", "/tasks?course_type=short_writing&limit=1", undefined, auth.access_token)
    );

    const page = data<Page<Task>>(res);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].course_type).toBe("short_writing");
  });

  it("rejects reading results before completion", () => {
    const auth = createUser("incomplete@example.com", ["space"]);
    const task = roll(auth.access_token, "reading");

    const res = handleTasks(req("GET", `/tasks/${task.id}/result`, undefined, auth.access_token));

    expect(problem(res)).toMatchObject({
      status: 400,
      code: "invalid_state",
    });
  });

  it("returns the accepted shape for writing submit and retry", () => {
    const auth = createUser("writer@example.com", ["travel"]);
    const task = roll(auth.access_token, "writing");

    const submit = data<WritingSubmitAccepted>(
      handleTasks(
        req(
          "POST",
          `/tasks/${task.id}/submit`,
          { full_text: "A complete enough answer for the mock." },
          auth.access_token
        )
      )
    );
    expect(submit).toEqual({
      id: task.id,
      status: "processing",
      submitted_at: expect.any(String),
    });
    expect("course_type" in submit).toBe(false);

    const stored = getState().tasks[task.id];
    stored.status = "failed";
    stored.failed_at = new Date().toISOString();
    stored.fail_reason = "LLM unavailable";
    commit();

    const retry = data<WritingSubmitAccepted>(
      handleTasks(req("POST", `/tasks/${task.id}/retry`, undefined, auth.access_token))
    );
    expect(retry).toEqual({
      id: task.id,
      status: "processing",
      submitted_at: submit.submitted_at,
    });
    expect("course_type" in retry).toBe(false);
  });

  it("only retries failed writing tasks", () => {
    const auth = createUser("retry@example.com", ["space"]);
    const task = roll(auth.access_token, "reading");

    const res = handleTasks(req("POST", `/tasks/${task.id}/retry`, undefined, auth.access_token));

    expect(problem(res)).toMatchObject({
      status: 400,
      code: "invalid_state",
    });
  });
});
