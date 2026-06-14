import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import LandingRoute from "../landing";
import type { User } from "~/lib/api/types";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

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

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LandingRoute />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = { user: null, ready: true };
});

describe("LandingRoute", () => {
  it("renders public calls to action for signed-out visitors", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /learn english through stories/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start free/i })).toHaveAttribute(
      "href",
      "/signup"
    );
    expect(screen.getByRole("link", { name: /i have an account/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects completed authenticated users to the dashboard", async () => {
    mockAuthState.user = completedUser;
    renderLanding();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true })
    );
  });

  it("redirects authenticated users who still need onboarding", async () => {
    mockAuthState.user = { ...completedUser, onboarding_completed: false };
    renderLanding();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true })
    );
  });

  it("does not redirect while auth state is still loading", () => {
    mockAuthState = { user: completedUser, ready: false };
    renderLanding();

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
