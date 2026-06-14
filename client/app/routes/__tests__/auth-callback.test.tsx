import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallbackRoute from "../auth-callback";

const mockNavigate = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: null,
    ready: true,
    refreshSession: mockRefreshSession,
  }),
}));

function renderCallback(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <AuthCallbackRoute />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
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

  it("shows an error state when Google returns an error", async () => {
    renderCallback("?error=google_oauth_denied");
    expect(
      await screen.findByText("Google sign-in could not be completed.")
    ).toBeInTheDocument();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });
});
