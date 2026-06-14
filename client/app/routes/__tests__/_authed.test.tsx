import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import AuthedLayout from "../_authed";
import type { ReactNode } from "react";
import type { User } from "~/lib/api/types";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPush = vi.fn();

vi.mock("~/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/components/Toast")>();
  return { ...actual, useToast: () => ({ push: mockPush }) };
});

vi.mock("~/components/Shell", () => ({
  Shell: ({ children }: { children: ReactNode }) => (
    <div data-testid="mock-shell">{children}</div>
  ),
}));

let mockAuthState: { user: User | null; ready: boolean };

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

const completedUser: User = {
  id: "user-1",
  email: "maya@example.com",
  email_verified: true,
  first_name: "Maya",
  last_name: "Patel",
  year_of_birth: 2014,
  grade_level: 7,
  phone_number: null,
  avatar_url: null,
  display_locale: "en",
  theme_preference: "auto",
  text_size_preference: "md",
  reduce_motion: false,
  notif_email_enabled: true,
  notif_inapp_enabled: true,
  interests: ["animals"],
  role: "user",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
  onboarding_completed: true,
};

function renderAuthedLayout(entry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AuthedLayout />}>
          <Route path="/dashboard" element={<div>Dashboard content</div>} />
          <Route path="/tasks" element={<div>Tasks content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = { user: completedUser, ready: true };
});

describe("AuthedLayout guards", () => {
  it("shows a loading guard while auth state is not ready", () => {
    mockAuthState = { user: null, ready: false };
    renderAuthedLayout();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects signed-out users to login with the current path as returnTo", async () => {
    mockAuthState = { user: null, ready: true };
    renderAuthedLayout("/tasks?filter=active");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/login?returnTo=%2Ftasks%3Ffilter%3Dactive",
        { replace: true }
      )
    );
  });

  it("redirects users who have not completed onboarding", async () => {
    mockAuthState = {
      user: { ...completedUser, onboarding_completed: false },
      ready: true,
    };
    renderAuthedLayout();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true })
    );
  });

  it("renders protected content inside Shell for onboarded users", () => {
    renderAuthedLayout();

    expect(screen.getByTestId("mock-shell")).toHaveTextContent("Dashboard content");
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("AuthedLayout writing completion toast", () => {
  it("pushes an actionable toast and routes to the writing result", async () => {
    renderAuthedLayout();

    window.dispatchEvent(
      new CustomEvent("storyteller:task-completed", {
        detail: { task_id: "task-42", title: "Moon Journal", score: 88 },
      })
    );

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Your writing task is ready!",
          body: expect.stringMatching(/Moon Journal.+88/),
          action: "View result",
        })
      )
    );

    const toast = mockPush.mock.calls[0][0] as { onAction: () => void };
    toast.onAction();

    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-42/result");
  });

  it("ignores completion events without details", () => {
    renderAuthedLayout();

    window.dispatchEvent(new CustomEvent("storyteller:task-completed"));

    expect(mockPush).not.toHaveBeenCalled();
  });
});
