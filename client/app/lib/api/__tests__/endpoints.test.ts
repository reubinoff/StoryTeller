import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMocks = vi.hoisted(() => ({
  apiUrl: vi.fn((path: string, query?: Record<string, unknown>) => ({
    path,
    query,
  })),
  request: vi.fn(),
}));

vi.mock("../client", () => ({
  apiUrl: clientMocks.apiUrl,
  request: clientMocks.request,
}));

import { api } from "../endpoints";

describe("api endpoint helpers", () => {
  beforeEach(() => {
    clientMocks.apiUrl.mockClear();
    clientMocks.request.mockReset();
    clientMocks.request.mockResolvedValue({});
  });

  it("posts signup without an auth header", async () => {
    const body = {
      first_name: "Maya",
      last_name: "Patel",
      email: "maya@example.com",
      password: "Snowflake42",
      year_of_birth: 2017,
    };

    await api.auth.signup(body);

    expect(clientMocks.request).toHaveBeenCalledWith("/auth/signup", {
      method: "POST",
      body,
      noAuth: true,
    });
  });

  it("builds the Google redirect start URL", () => {
    const url = api.auth.googleStartUrl("/courses", "signup");

    expect(url).toEqual({
      path: "/auth/google/start",
      query: { return_to: "/courses", intent: "signup" },
    });
  });

  it("lists tasks with an optional status query", async () => {
    await api.tasks.list("completed");

    expect(clientMocks.request).toHaveBeenCalledWith("/tasks", {
      query: { status: "completed" },
    });
  });

  it("submits and retries tasks with backend contract paths", async () => {
    await api.tasks.submit("task-1", {
      answers: [{ question_id: "q1", answer: 0 }],
    });
    await api.tasks.retry("task-1");

    expect(clientMocks.request).toHaveBeenNthCalledWith(1, "/tasks/task-1/submit", {
      method: "POST",
      body: { answers: [{ question_id: "q1", answer: 0 }] },
    });
    expect(clientMocks.request).toHaveBeenNthCalledWith(2, "/tasks/task-1/retry", {
      method: "POST",
    });
  });

  it("marks all notifications read", async () => {
    await api.me.notificationRead("notif-1");
    await api.me.notificationsReadAll();

    expect(clientMocks.request).toHaveBeenNthCalledWith(1, "/me/notifications/notif-1/read", {
      method: "POST",
    });
    expect(clientMocks.request).toHaveBeenNthCalledWith(2, "/me/notifications/read-all", {
      method: "POST",
    });
  });

  it("exposes cookie auth and account endpoints", async () => {
    await api.auth.refresh();
    await api.auth.forgotPassword();
    await api.me.metrics();
    await api.me.changePassword({
      current_password: "Oldpass1",
      new_password: "Newpass2",
    });
    await api.me.deleteAccount({ confirm: true });

    expect(clientMocks.request).toHaveBeenNthCalledWith(1, "/auth/refresh", {
      method: "POST",
      noAuth: true,
    });
    expect(clientMocks.request).toHaveBeenNthCalledWith(2, "/auth/password/forgot", {
      method: "POST",
      noAuth: true,
    });
    expect(clientMocks.request).toHaveBeenNthCalledWith(3, "/me/metrics");
    expect(clientMocks.request).toHaveBeenNthCalledWith(4, "/me/password/change", {
      method: "POST",
      body: {
        current_password: "Oldpass1",
        new_password: "Newpass2",
      },
    });
    expect(clientMocks.request).toHaveBeenNthCalledWith(5, "/me", {
      method: "DELETE",
      body: { confirm: true },
    });
  });

  it("uploads avatars with form data", async () => {
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await api.me.uploadAvatar(file);

    const [, options] = clientMocks.request.mock.calls[0] as [
      string,
      { method: string; body: FormData },
    ];
    expect(clientMocks.request).toHaveBeenCalledWith("/me/avatar", {
      method: "POST",
      body: expect.any(FormData),
    });
    expect(options.body.get("file")).toBe(file);
  });
});
