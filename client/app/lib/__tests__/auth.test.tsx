import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "~/components/Toast";
import { AuthProvider, useAuth } from "../auth";
import type { AuthResponse, DashboardResponse, User } from "../api/types";

// ---------------------------------------------------------------------------
// Module mock — controls all api calls AuthProvider makes.
// ---------------------------------------------------------------------------

vi.mock("~/lib/api/endpoints", () => ({
  api: {
    auth: {
      login: vi.fn(),
      signup: vi.fn(),
      google: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
    me: {
      get: vi.fn(),
      setInterests: vi.fn(),
      completeOnboarding: vi.fn(),
      dashboard: vi.fn(),
    },
  },
}));

import { api } from "~/lib/api/endpoints";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: "user-1",
  email: "test@test.com",
  email_verified: true,
  first_name: "Test",
  last_name: "User",
  year_of_birth: 2010,
  grade_level: 6,
  phone_number: null,
  avatar_url: null,
  display_locale: "en",
  theme_preference: "auto",
  text_size_preference: "md",
  reduce_motion: false,
  notif_email_enabled: true,
  notif_inapp_enabled: true,
  interests: [],
  role: "user",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
  onboarding_completed: true,
};

const mockAuthResponse: AuthResponse = {
  access_token: "tok-test",
  expires_in: 900,
  user: mockUser,
};

const mockDashboard: DashboardResponse = {
  greeting: "Hi",
  metrics: {
    tasks_completed: 0,
    current_streak: 0,
    longest_streak: 0,
    avg_score: 0,
    xp_total: 0,
    level: 1,
    level_label: "Apprentice",
  },
  in_progress: [],
  recent: [],
  recommended: [],
  achievements_recent: [],
};

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.mocked(api.auth.refresh).mockRejectedValue(new Error("No refresh cookie"));
  vi.mocked(api.me.get).mockRejectedValue(new Error("No access token"));
  vi.mocked(api.auth.logout).mockResolvedValue(null);
  vi.mocked(api.me.dashboard).mockResolvedValue(mockDashboard);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be inside <AuthProvider>"
    );
  });

  it("starts with user=null and becomes ready=true after mount", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.user).toBeNull();
  });

  it("restores user from localStorage on mount", async () => {
    localStorage.setItem("storyteller.auth.accessToken", "tok-test");
    localStorage.setItem("storyteller.auth.user", JSON.stringify(mockUser));
    vi.mocked(api.me.get).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.email).toBe("test@test.com"));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it("ignores corrupted localStorage data", async () => {
    localStorage.setItem("storyteller.auth.accessToken", "tok-test");
    localStorage.setItem("storyteller.auth.user", "{bad json");
    vi.mocked(api.me.get).mockRejectedValue(new Error("Expired token"));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.user).toBeNull();
  });
});

describe("signin", () => {
  it("sets the user on success", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "password");

    await waitFor(() => expect(result.current.user?.email).toBe("test@test.com"));
  });

  it("returns the user object", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    const user = await result.current.signin("test@test.com", "password");
    expect(user.id).toBe("user-1");
  });

  it("propagates errors from the API", async () => {
    vi.mocked(api.auth.login).mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await expect(result.current.signin("bad@email.com", "wrong")).rejects.toThrow();
    expect(result.current.user).toBeNull();
  });
});

describe("signup", () => {
  it("sets the user on success", async () => {
    vi.mocked(api.auth.signup).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signup({
      first_name: "Test",
      last_name: "User",
      email: "test@test.com",
      password: "pass",
      year_of_birth: 2010,
    });

    await waitFor(() => expect(result.current.user?.email).toBe("test@test.com"));
  });
});

describe("signout", () => {
  it("clears user and resets metrics", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    await waitFor(() => expect(result.current.user).not.toBeNull());

    result.current.signout();
    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.metrics.level).toBe(1);
  });

  it("clears localStorage token on signout", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    result.current.signout();

    expect(localStorage.getItem("storyteller.auth.accessToken")).toBeNull();
  });
});

describe("setInterests", () => {
  it("updates the user's interests", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    vi.mocked(api.me.setInterests).mockResolvedValue({ interests: ["animals", "space"] });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    await waitFor(() => expect(result.current.user).not.toBeNull());

    await result.current.setInterests(["animals", "space"]);
    await waitFor(() =>
      expect(result.current.user?.interests).toEqual(["animals", "space"])
    );
  });
});

describe("completeOnboarding", () => {
  it("persists onboarding and sets the returned user", async () => {
    const completed: User = {
      ...mockUser,
      onboarding_completed: true,
      interests: ["animals"],
    };
    vi.mocked(api.auth.login).mockResolvedValue({
      ...mockAuthResponse,
      user: { ...mockUser, onboarding_completed: false },
    });
    vi.mocked(api.me.completeOnboarding).mockResolvedValue(completed);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    const user = await result.current.completeOnboarding({
      year_of_birth: 2010,
      grade_level: 6,
      interest_ids: ["animals"],
    });

    expect(user.onboarding_completed).toBe(true);
    await waitFor(() => expect(result.current.user?.interests).toEqual(["animals"]));
  });
});
