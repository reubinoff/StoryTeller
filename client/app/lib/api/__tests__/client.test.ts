import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  buildUrl,
  getAccessToken,
  notifyUnauthorized,
  request,
  setAccessToken,
} from "../client";

describe("getAccessToken / setAccessToken", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setAccessToken("tok-abc123");
    expect(getAccessToken()).toBe("tok-abc123");
  });

  it("removes the token when passed null", () => {
    setAccessToken("tok-abc123");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("overwrites a previously stored token", () => {
    setAccessToken("old-token");
    setAccessToken("new-token");
    expect(getAccessToken()).toBe("new-token");
  });
});

describe("ApiError", () => {
  it("uses detail as message when provided", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      code: "bad_request",
      detail: "Email is invalid",
    });
    expect(err.message).toBe("Email is invalid");
    expect(err.status).toBe(400);
    expect(err.problem.code).toBe("bad_request");
  });

  it("falls back to title when detail is absent", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "not_found",
    });
    expect(err.message).toBe("Not Found");
    expect(err.status).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Server Error",
      status: 500,
      code: "server_error",
    });
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes the full problem object", () => {
    const problem = {
      type: "about:blank",
      title: "Validation Failed",
      status: 422,
      code: "validation_error",
      errors: [{ field: "email", message: "Invalid format" }],
    };
    const err = new ApiError(problem);
    expect(err.problem).toEqual(problem);
  });
});

describe("buildUrl", () => {
  it("adds a leading slash when the path omits one", () => {
    expect(buildUrl("tasks")).toBe("/tasks");
  });

  it("serializes defined query params and skips empty values", () => {
    expect(
      buildUrl("/tasks", {
        status: "completed",
        limit: 10,
        cursor: null,
        ignored: undefined,
      })
    ).toBe("/tasks?status=completed&limit=10");
  });
});

describe("unauthorized notifications", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("dispatches the unauthorized event with request context", () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    notifyUnauthorized("/tasks?status=in_progress");

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      path: "/tasks?status=in_progress",
      status: 401,
    });

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("notifies when an authenticated request receives a 401", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(request("/me")).rejects.toMatchObject({ status: 401 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      path: "/me",
      status: 401,
    });

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("does not notify for noAuth 401s like failed login", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(
      request("/auth/login", {
        method: "POST",
        body: { email: "nobody@example.com", password: "wrong" },
        noAuth: true,
      })
    ).rejects.toMatchObject({ status: 401 });

    expect(listener).not.toHaveBeenCalled();

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });
});
