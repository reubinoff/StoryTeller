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
      logout: vi.fn(),
    },
    me: {
      setInterests: vi.fn(),
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
    localStorage.setItem("lq.auth.accessToken", "tok-test");
    localStorage.setItem("lq.auth.user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.user?.email).toBe("test@test.com");
  });

  it("ignores corrupted localStorage data", async () => {
    localStorage.setItem("lq.auth.accessToken", "tok-test");
    localStorage.setItem("lq.auth.user", "{bad json");

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

    expect(localStorage.getItem("lq.auth.accessToken")).toBeNull();
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
