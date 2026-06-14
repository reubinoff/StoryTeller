import { describe, expect, it } from "vitest";
import type { Task, User } from "~/lib/api/types";
import { postAuthDestination, safeReturnTo } from "../auth-routing";
import { taskActionLabel, taskTarget } from "../task-routing";

const user = (onboarding_completed: boolean): User =>
  ({
    id: "user-1",
    email: "maya@example.com",
    email_verified: true,
    first_name: "Maya",
    last_name: "Patel",
    year_of_birth: 2017,
    grade_level: 4,
    phone_number: null,
    avatar_url: null,
    display_locale: "en",
    theme_preference: "auto",
    text_size_preference: "md",
    reduce_motion: false,
    notif_email_enabled: true,
    notif_inapp_enabled: true,
    interests: ["space"],
    role: "user",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    onboarding_completed,
  }) satisfies User;

describe("auth routing helpers", () => {
  it("keeps safe internal return paths", () => {
    expect(safeReturnTo("/courses/reading")).toBe("/courses/reading");
  });

  it("falls back for external or auth-loop return paths", () => {
    expect(safeReturnTo("https://example.com")).toBe("/dashboard");
    expect(safeReturnTo("//example.com")).toBe("/dashboard");
    expect(safeReturnTo("/login?returnTo=/settings")).toBe("/dashboard");
    expect(safeReturnTo("/auth/callback")).toBe("/dashboard");
  });

  it("routes incomplete users to onboarding before returnTo", () => {
    expect(postAuthDestination(user(false), "/courses")).toBe("/onboarding");
    expect(postAuthDestination(user(true), "/courses")).toBe("/courses");
  });
});

describe("task routing helpers", () => {
  const task = (status: Task["status"]) =>
    ({ id: "task-1", status }) satisfies Pick<Task, "id" | "status">;

  it("opens final states on the result page", () => {
    expect(taskTarget(task("completed"))).toBe("/tasks/task-1/result");
    expect(taskTarget(task("needs_retry"))).toBe("/tasks/task-1/result");
    expect(taskTarget(task("failed"))).toBe("/tasks/task-1/result");
  });

  it("opens active states on the task page", () => {
    expect(taskTarget(task("not_started"))).toBe("/tasks/task-1");
    expect(taskTarget(task("processing"))).toBe("/tasks/task-1");
  });

  it("labels the task action by status", () => {
    expect(taskActionLabel("not_started")).toBe("Start");
    expect(taskActionLabel("completed")).toBe("View result");
    expect(taskActionLabel("needs_retry")).toBe("Try again");
    expect(taskActionLabel("processing")).toBe("Check status");
    expect(taskActionLabel("in_progress")).toBe("Resume");
  });
});
