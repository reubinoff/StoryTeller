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

describe("getCookie", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    document.cookie = "st_csrf=; Max-Age=0";
  });

  it("returns null when the cookie is absent", async () => {
    const { getCookie } = await loadClient();

    expect(getCookie("st_csrf")).toBeNull();
  });

  it("reads and decodes a cookie value", async () => {
    const { getCookie } = await loadClient();

    document.cookie = "st_csrf=csrf%20123";

    expect(getCookie("st_csrf")).toBe("csrf 123");
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
    document.cookie = "st_csrf=; Max-Age=0";
  });

  it("returns JSON from successful fetch responses", async () => {
    const { request } = await loadClient();
    const fetchMock = stubFetch(
      jsonResponse({ id: "task-1", status: "completed" }, { status: 200 })
    );
    document.cookie = "st_csrf=csrf-abc123";

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
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-abc123",
    });
    expect(init.headers).not.toMatchObject({
      Authorization: expect.any(String),
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

  it("turns non-JSON error responses into ApiError problems", async () => {
    const { request } = await loadClient();
    stubFetch(
      new Response("plain failure", {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(request("/tasks/task-1")).rejects.toMatchObject({
      status: 500,
      problem: {
        status: 500,
        code: "invalid_response",
      },
    });
  });

  it("retries an authenticated 401 once after refreshing cookies", async () => {
    const { request } = await loadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            type: "about:blank",
            title: "Unauthorized",
            status: 401,
            code: "unauthenticated",
          },
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ id: "user-1" }, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request<{ id: string }>("/me")).resolves.toEqual({ id: "user-1" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${apiBase}/auth/refresh`);
    expect(fetchMock.mock.calls[2][0]).toBe(`${apiBase}/me`);
  });
});

describe("unauthorized notifications", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.cookie = "st_csrf=; Max-Age=0";
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
    const { UNAUTHORIZED_EVENT, request } = await loadClient();
    const problem: Problem = {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      code: "unauthorized",
      detail: "Please sign in again",
    };
    stubFetch(jsonResponse(problem, { status: 401, statusText: "Unauthorized" }));
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
