import { beforeEach, describe, expect, it } from "vitest";
import type { AuthResponse, Notification } from "../../types";
import { getState, reset } from "../db";
import { handleAuth } from "../handlers/auth";
import { handleMe } from "../handlers/me";
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

function createUser() {
  return data<AuthResponse>(
    handleAuth(
      req("POST", "/auth/signup", {
        first_name: "Maya",
        last_name: "Patel",
        email: "maya@example.com",
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
