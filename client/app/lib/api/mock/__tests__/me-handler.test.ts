import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse, Notification, Task } from "../../types";
import { getState, reset } from "../db";
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

function createUser(email = "maya@example.com") {
  return data<AuthResponse>(
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
}

beforeEach(() => {
  reset();
  localStorage.clear();
});

describe("mock me handler contract", () => {
  it("rejects empty, oversized, and unknown interest selections", () => {
    const auth = createUser();

    expect(
      problem(handleMe(req("PUT", "/me/interests", { interest_ids: [] }, auth.access_token)))
    ).toMatchObject({ status: 422, code: "validation_error" });
    expect(
      problem(
        handleMe(
          req(
            "PUT",
            "/me/interests",
            {
              interest_ids: [
                "animals",
                "sports",
                "music",
                "movies",
                "science",
                "space",
                "tech",
              ],
            },
            auth.access_token
          )
        )
      )
    ).toMatchObject({ status: 422, code: "validation_error" });
    expect(
      problem(
        handleMe(
          req("PUT", "/me/interests", { interest_ids: ["unknown"] }, auth.access_token)
        )
      )
    ).toMatchObject({ status: 422, code: "validation_error" });
  });

  it("removes only the current user's tasks for dropped interests", () => {
    const authA = createUser("maya@example.com");
    data(
      handleMe(
        req(
          "PUT",
          "/me/interests",
          { interest_ids: ["space", "travel"] },
          authA.access_token
        )
      )
    );
    const spaceTask = data<Task>(
      handleTasks(
        req(
          "POST",
          "/courses/reading/tasks",
          { interest_id: "space" },
          authA.access_token
        )
      )
    );
    const travelTask = data<Task>(
      handleTasks(
        req(
          "POST",
          "/courses/writing/tasks",
          { interest_id: "travel" },
          authA.access_token
        )
      )
    );

    const authB = createUser("leo@example.com");
    data(
      handleMe(
        req("PUT", "/me/interests", { interest_ids: ["space"] }, authB.access_token)
      )
    );
    const otherUserSpaceTask = data<Task>(
      handleTasks(
        req(
          "POST",
          "/courses/reading/tasks",
          { interest_id: "space" },
          authB.access_token
        )
      )
    );

    data(
      handleMe(
        req("PUT", "/me/interests", { interest_ids: ["travel"] }, authA.access_token)
      )
    );

    const state = getState();
    expect(state.tasks[spaceTask.id]).toBeUndefined();
    expect(state.user_tasks[authA.user.id]).not.toContain(spaceTask.id);
    expect(state.tasks[travelTask.id]?.interest_id).toBe("travel");
    expect(state.user_tasks[authA.user.id]).toContain(travelTask.id);
    expect(state.tasks[otherUserSpaceTask.id]?.interest_id).toBe("space");
    expect(state.user_tasks[authB.user.id]).toContain(otherUserSpaceTask.id);
    expect(
      problem(handleTasks(req("GET", `/tasks/${spaceTask.id}`, undefined, authA.access_token)))
    ).toMatchObject({ status: 404, code: "not_found" });
  });

  it("marks a single notification read and leaves missing ids as a no-op", () => {
    const auth = createUser();
    const notification: Notification = {
      id: "notif-1",
      kind: "task_completed",
      payload: { task_id: "task-1" },
      read_at: null,
      created_at: "2026-06-01T10:00:00Z",
    };
    getState().notifications[auth.user.id] = [notification];

    data(handleMe(req("POST", "/me/notifications/notif-1/read", undefined, auth.access_token)));
    const afterRead = data<{ items: Notification[] }>(
      handleMe(req("GET", "/me/notifications", undefined, auth.access_token))
    );
    expect(afterRead.items[0].read_at).toEqual(expect.any(String));

    data(handleMe(req("POST", "/me/notifications/missing/read", undefined, auth.access_token)));
    const afterMissing = data<{ items: Notification[] }>(
      handleMe(req("GET", "/me/notifications", undefined, auth.access_token))
    );
    expect(afterMissing.items).toHaveLength(1);
  });
});
