import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type {
  AdminAuditEvent,
  AdminOverview,
  AdminSession,
  AdminUserDetail,
  AdminUserSummary,
  Page,
  Problem,
} from "./types";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": "csrf-token",
    },
  });
}

function problem(status: number, code: string, title: string): Problem {
  return {
    type: `https://errors.storyteller.app/${code}`,
    title,
    status,
    code,
  };
}

const adminUser: AdminUserSummary = {
  id: "admin-1",
  email: "reubinoff@gmail.com",
  first_name: "Reubinoff",
  last_name: "Admin",
  role: "admin",
  status: "active",
  protected_admin: true,
  created_at: "2026-06-15T08:00:00Z",
  updated_at: "2026-06-15T08:00:00Z",
  tasks_total: 0,
  tasks_completed: 0,
  avg_score: null,
  last_activity_at: null,
};

const learnerSummary: AdminUserSummary = {
  id: "user-1",
  email: "learner@example.com",
  first_name: "Mira",
  last_name: "Stone",
  role: "user",
  status: "active",
  protected_admin: false,
  created_at: "2026-06-15T08:10:00Z",
  updated_at: "2026-06-15T08:10:00Z",
  tasks_total: 4,
  tasks_completed: 2,
  avg_score: 82,
  last_activity_at: "2026-06-15T09:00:00Z",
};

const learnerDetail: AdminUserDetail = {
  ...learnerSummary,
  email_verified: true,
  grade_level: 6,
  year_of_birth: 2014,
  onboarding_completed: true,
  interests: ["books"],
  task_status_counts: [
    { status: "completed", count: 2 },
    { status: "in_progress", count: 1 },
  ],
};

const promotedDetail: AdminUserDetail = {
  ...learnerDetail,
  role: "admin",
};

const session: AdminSession = {
  user: adminUser,
  protected_admin: true,
};

const overview: AdminOverview = {
  range_days: 30,
  generated_at: "2026-06-15T09:30:00Z",
  kpis: {
    users_total: 2,
    users_active: 2,
    users_suspended: 0,
    admins_total: 1,
    signups_in_range: 2,
    tasks_created_in_range: 4,
    tasks_completed_in_range: 2,
    tasks_failed_in_range: 0,
    writing_processing: 0,
    avg_completed_score: 82,
  },
  daily_activity: [
    { date: "2026-06-14", signups: 0, tasks_created: 1, tasks_completed: 1 },
    { date: "2026-06-15", signups: 2, tasks_created: 3, tasks_completed: 1 },
  ],
  course_metrics: [{ course_type: "short_writing", completed_count: 2, avg_score: 82 }],
};

const usersPage: Page<AdminUserSummary> = {
  items: [learnerSummary],
  next_cursor: null,
};

const auditPage: Page<AdminAuditEvent> = {
  items: [
    {
      id: "audit-1",
      actor_user_id: "admin-1",
      actor_email: "reubinoff@gmail.com",
      target_user_id: "user-1",
      target_email: "learner@example.com",
      action: "admin_granted",
      metadata: { from_role: "user", to_role: "admin" },
      created_at: "2026-06-15T09:20:00Z",
    },
  ],
  next_cursor: null,
};

function queueAdminLoad() {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(session))
    .mockResolvedValueOnce(jsonResponse(overview))
    .mockResolvedValueOnce(jsonResponse(usersPage))
    .mockResolvedValueOnce(jsonResponse(auditPage))
    .mockResolvedValueOnce(jsonResponse(learnerDetail));
}

describe("App", () => {
  it("hydrates an admin session and renders the dashboard", async () => {
    queueAdminLoad();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Operations" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect((await screen.findAllByText("learner@example.com")).length).toBeGreaterThan(0);
    expect(screen.getByText("Protected admin")).toBeInTheDocument();
  });

  it("shows access denied for an authenticated non-admin", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(problem(403, "admin_required", "Admin access required"), 403)
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();
  });

  it("filters users and can promote the selected user", async () => {
    queueAdminLoad();
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(usersPage))
      .mockResolvedValueOnce(jsonResponse(promotedDetail))
      .mockResolvedValueOnce(jsonResponse(auditPage))
      .mockResolvedValueOnce(jsonResponse({ ...overview, kpis: { ...overview.kpis, admins_total: 2 } }));

    await user.type(screen.getByLabelText("Search users"), "mira");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/users?query=mira&status=active&limit=50"),
        expect.any(Object)
      );
    });

    await user.click(screen.getByRole("button", { name: "Make admin" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/admin/users/user-1/admin"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ is_admin: true }),
        })
      );
    });
    expect(await screen.findByRole("button", { name: "Remove admin" })).toBeInTheDocument();
  });

  it("shows failed admin action errors", async () => {
    queueAdminLoad();
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        problem(409, "admin_safety_violation", "Cannot suspend the last active admin"),
        409
      )
    );

    await user.click(screen.getByRole("button", { name: "Suspend" }));

    expect(
      await screen.findByText("Cannot suspend the last active admin")
    ).toBeInTheDocument();
  });
});
