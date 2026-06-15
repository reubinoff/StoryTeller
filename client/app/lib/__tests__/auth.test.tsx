import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToastProvider } from "~/components/Toast";
import { AuthProvider, useAuth } from "../auth";
import { UNAUTHORIZED_EVENT } from "../api/client";
import type { AuthResponse, User } from "../api/types";

// ---------------------------------------------------------------------------
// Module mock — controls all api calls AuthProvider makes.
// ---------------------------------------------------------------------------

vi.mock("~/lib/api/endpoints", () => ({
  api: {
    auth: {
      login: vi.fn(),
      signup: vi.fn(),
      googleStartUrl: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
    me: {
      get: vi.fn(),
      setInterests: vi.fn(),
      completeOnboarding: vi.fn(),
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
  user: mockUser,
};

function setSystemDarkMode(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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
  setSystemDarkMode(false);
  document.body.dataset.theme = "light";
  document.body.dataset.themePreference = "auto";
  document.body.dataset.textSize = "md";
  document.body.dataset.reduceMotion = "false";
  document.documentElement.style.colorScheme = "";
  vi.mocked(api.auth.refresh).mockRejectedValue(new Error("No refresh cookie"));
  vi.mocked(api.me.get).mockRejectedValue(new Error("No access token"));
  vi.mocked(api.auth.logout).mockResolvedValue(null);
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

  it("loads the current user after refreshing cookie auth on mount", async () => {
    vi.mocked(api.auth.refresh).mockResolvedValue(undefined);
    vi.mocked(api.me.get).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.email).toBe("test@test.com"));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(api.auth.refresh).toHaveBeenCalled();
  });

  it("applies display preferences from the loaded user", async () => {
    const darkUser: User = {
      ...mockUser,
      theme_preference: "dark",
      text_size_preference: "lg",
      reduce_motion: true,
    };
    vi.mocked(api.auth.refresh).mockResolvedValue(undefined);
    vi.mocked(api.me.get).mockResolvedValue(darkUser);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user?.email).toBe("test@test.com"));
    await waitFor(() => expect(document.body.dataset.theme).toBe("dark"));
    expect(document.body.dataset.themePreference).toBe("dark");
    expect(document.body.dataset.textSize).toBe("lg");
    expect(document.body.dataset.reduceMotion).toBe("true");
  });

  it("resolves auto display preferences from system dark mode", async () => {
    setSystemDarkMode(true);
    vi.mocked(api.auth.refresh).mockResolvedValue(undefined);
    vi.mocked(api.me.get).mockResolvedValue(mockUser);

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(document.body.dataset.theme).toBe("dark"));
    expect(document.body.dataset.themePreference).toBe("auto");
  });

  it("keeps the session empty when refresh fails", async () => {
    vi.mocked(api.auth.refresh).mockRejectedValue(new Error("No refresh cookie"));

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
  it("clears user", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    await waitFor(() => expect(result.current.user).not.toBeNull());

    result.current.signout();
    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it("calls the backend logout endpoint on signout", async () => {
    vi.mocked(api.auth.login).mockResolvedValue(mockAuthResponse);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    result.current.signout();

    await waitFor(() => expect(api.auth.logout).toHaveBeenCalled());
  });

  it("resets display preferences on signout", async () => {
    const darkUser: User = {
      ...mockUser,
      theme_preference: "dark",
      text_size_preference: "lg",
      reduce_motion: true,
    };
    vi.mocked(api.auth.login).mockResolvedValue({
      ...mockAuthResponse,
      user: darkUser,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await result.current.signin("test@test.com", "pass");
    await waitFor(() => expect(document.body.dataset.theme).toBe("dark"));

    result.current.signout();

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(document.body.dataset.theme).toBe("light");
    expect(document.body.dataset.themePreference).toBe("light");
    expect(document.body.dataset.textSize).toBe("md");
    expect(document.body.dataset.reduceMotion).toBe("false");
  });

  it("clears the session when an authenticated API request returns 401", async () => {
    vi.mocked(api.auth.refresh).mockResolvedValue(undefined);
    vi.mocked(api.me.get).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user?.id).toBe("user-1"));

    window.dispatchEvent(
      new CustomEvent(UNAUTHORIZED_EVENT, {
        detail: { path: "/tasks", status: 401 },
      })
    );

    await waitFor(() => expect(result.current.user).toBeNull());
  });
});

describe("setInterests", () => {
  it("updates the user's interests", async () => {
    const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
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
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me", "dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["me", "metrics"] });
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
