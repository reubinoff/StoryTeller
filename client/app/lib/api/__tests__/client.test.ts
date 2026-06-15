import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem } from "../types";

type ClientModule = typeof import("../client");

const apiBase = "https://api.example.test/api/v1";

async function loadClient(): Promise<ClientModule> {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", apiBase);
  return import("../client");
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("getAccessToken / setAccessToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("returns null when nothing is stored", async () => {
    const { getAccessToken } = await loadClient();

    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves a token", async () => {
    const { getAccessToken, setAccessToken } = await loadClient();

    setAccessToken("tok-abc123");

    expect(getAccessToken()).toBe("tok-abc123");
  });

  it("removes the token when passed null", async () => {
    const { getAccessToken, setAccessToken } = await loadClient();

    setAccessToken("tok-abc123");
    setAccessToken(null);

    expect(getAccessToken()).toBeNull();
  });

  it("overwrites a previously stored token", async () => {
    const { getAccessToken, setAccessToken } = await loadClient();

    setAccessToken("old-token");
    setAccessToken("new-token");

    expect(getAccessToken()).toBe("new-token");
  });
});

describe("ApiError", () => {
  it("uses detail as message when provided", async () => {
    const { ApiError } = await loadClient();
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

  it("falls back to title when detail is absent", async () => {
    const { ApiError } = await loadClient();
    const err = new ApiError({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "not_found",
    });

    expect(err.message).toBe("Not Found");
    expect(err.status).toBe(404);
  });

  it("is an instance of Error", async () => {
    const { ApiError } = await loadClient();
    const err = new ApiError({
      type: "about:blank",
      title: "Server Error",
      status: 500,
      code: "server_error",
    });

    expect(err).toBeInstanceOf(Error);
  });

  it("exposes the full problem object", async () => {
    const { ApiError } = await loadClient();
    const problem: Problem = {
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

describe("buildUrl / apiUrl", () => {
  it("adds a leading slash when the path omits one", async () => {
    const { buildUrl } = await loadClient();

    expect(buildUrl("tasks")).toBe("/tasks");
  });

  it("serializes defined query params and skips empty values", async () => {
    const { buildUrl } = await loadClient();

    expect(
      buildUrl("/tasks", {
        status: "completed",
        limit: 10,
        cursor: null,
        ignored: undefined,
      })
    ).toBe("/tasks?status=completed&limit=10");
  });

  it("builds full API URLs from the configured base", async () => {
    const { apiUrl } = await loadClient();

    expect(apiUrl("/tasks", { status: "completed" })).toBe(
      `${apiBase}/tasks?status=completed`
    );
  });
});

describe("request", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("returns JSON from successful fetch responses", async () => {
    const { request, setAccessToken } = await loadClient();
    const fetchMock = stubFetch(
      jsonResponse({ id: "task-1", status: "completed" }, { status: 200 })
    );

    setAccessToken("tok-abc123");
    const data = await request<{ id: string; status: string }, { answer: string }>(
      "tasks/task-1",
      {
        method: "POST",
        body: { answer: "A moonlit story." },
        query: { include: "result", skipped: null },
      }
    );

    expect(data).toEqual({ id: "task-1", status: "completed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${apiBase}/tasks/task-1?include=result`);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ answer: "A moonlit story." }),
    });
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer tok-abc123",
      "Content-Type": "application/json",
    });
  });

  it("returns undefined for 204 responses", async () => {
    const { request } = await loadClient();
    stubFetch(new Response(null, { status: 204 }));

    await expect(request("/me/notifications/read-all")).resolves.toBeUndefined();
  });

  it("throws ApiError with parsed Problem details", async () => {
    const { ApiError, request } = await loadClient();
    const problem: Problem = {
      type: "about:blank",
      title: "Validation Failed",
      status: 422,
      code: "validation_error",
      detail: "Answer is required",
      errors: [{ field: "answer", message: "Required" }],
    };
    stubFetch(jsonResponse(problem, { status: 422, statusText: "Unprocessable Entity" }));

    const promise = request("/tasks/task-1/submit", { method: "POST" });

    await expect(promise).rejects.toEqual(
      expect.objectContaining({
        problem,
        status: 422,
      })
    );
    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it("returns a parsed Problem when throwOnError is false", async () => {
    const { request } = await loadClient();
    const problem: Problem = {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "not_found",
    };
    stubFetch(jsonResponse(problem, { status: 404, statusText: "Not Found" }));

    await expect(
      request<Problem>("/tasks/missing", { throwOnError: false })
    ).resolves.toEqual(problem);
  });
});

describe("unauthorized notifications", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("dispatches the unauthorized event with request context", async () => {
    const { UNAUTHORIZED_EVENT, notifyUnauthorized } = await loadClient();
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
    const { UNAUTHORIZED_EVENT, request, setAccessToken } = await loadClient();
    const problem: Problem = {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      code: "unauthorized",
      detail: "Please sign in again",
    };
    stubFetch(jsonResponse(problem, { status: 401, statusText: "Unauthorized" }));
    setAccessToken("tok-abc123");
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(request("/me")).rejects.toMatchObject({ problem, status: 401 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      path: "/me",
      status: 401,
    });

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("does not notify for noAuth 401s like failed login", async () => {
    const { UNAUTHORIZED_EVENT, request } = await loadClient();
    const problem: Problem = {
      type: "about:blank",
      title: "Invalid credentials",
      status: 401,
      code: "invalid_credentials",
      detail: "Email or password is incorrect",
    };
    const fetchMock = stubFetch(
      jsonResponse(problem, { status: 401, statusText: "Unauthorized" })
    );
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await expect(
      request("/auth/login", {
        method: "POST",
        body: { email: "nobody@example.com", password: "wrong" },
        noAuth: true,
      })
    ).rejects.toMatchObject({ problem, status: 401 });

    expect(listener).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toMatchObject({ Authorization: expect.any(String) });

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });
});
