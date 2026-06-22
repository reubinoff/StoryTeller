import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallbackRoute from "../auth-callback";
import type { User } from "~/lib/api/types";

const mockNavigate = vi.fn();
const mockRefreshSession = vi.fn();
let mockAuthState: {
  user: User | null;
  ready: boolean;
  refreshSession: ReturnType<typeof vi.fn>;
};

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

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
  english_level: 44,
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

function renderCallback(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <AuthCallbackRoute />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = {
    user: null,
    ready: true,
    refreshSession: mockRefreshSession,
  };
});

describe("AuthCallbackRoute", () => {
  it("refreshes the session and routes completed users to returnTo", async () => {
    mockRefreshSession.mockResolvedValue({ onboarding_completed: true });
    renderCallback("?returnTo=/courses");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/courses", { replace: true })
    );
  });

  it("routes incomplete users to onboarding", async () => {
    mockRefreshSession.mockResolvedValue({ onboarding_completed: false });
    renderCallback("?returnTo=/courses");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true })
    );
  });

  it("falls back to dashboard when returnTo is unsafe", async () => {
    mockRefreshSession.mockResolvedValue(completedUser);
    renderCallback("?returnTo=//evil.example/path");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true })
    );
  });

  it("uses an existing ready user without refreshing the session", async () => {
    mockAuthState.user = completedUser;
    renderCallback("?returnTo=/courses");
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/courses", { replace: true })
    );
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it("shows an expired-session message when refresh returns no user", async () => {
    mockRefreshSession.mockResolvedValue(null);
    renderCallback();

    expect(
      await screen.findByText("Your sign-in session expired. Please try again.")
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows an error state when Google returns an error", async () => {
    renderCallback("?error=google_oauth_denied");
    expect(
      await screen.findByText("Google sign-in could not be completed.")
    ).toBeInTheDocument();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
