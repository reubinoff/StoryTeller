/**
 * Auth context: keeps user + token in state, persists token to localStorage,
 * and exposes signin / signup / signout actions plus the topbar metrics
 * (streak / xp) that the Shell needs.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, getAccessToken, isUsingMock, setAccessToken } from "./api/client";
import { api } from "./api/endpoints";
import {
  applyDisplayPreferences,
  displayPreferencesFromUser,
  watchAutoThemePreference,
} from "./display-preferences";
import type {
  CompleteOnboardingRequest,
  DashboardMetrics,
  InterestId,
  User,
} from "./api/types";

const USER_KEY = "storyteller.auth.user";

const DEFAULT_METRICS: DashboardMetrics = {
  tasks_completed: 0,
  current_streak: 0,
  longest_streak: 0,
  avg_score: 0,
  xp_total: 0,
  level: 1,
  level_label: "Apprentice",
};

interface AuthContextValue {
  user: User | null;
  metrics: DashboardMetrics;
  ready: boolean;
  signin: (email: string, password: string) => Promise<User>;
  signup: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    year_of_birth: number;
  }) => Promise<User>;
  signinGoogle: (returnTo?: string, intent?: "login" | "signup") => Promise<User>;
  refreshSession: () => Promise<User | null>;
  signout: () => void;
  setUser: (u: User | null) => void;
  setInterests: (ids: InterestId[]) => Promise<void>;
  completeOnboarding: (data: CompleteOnboardingRequest) => Promise<User>;
  setMetrics: (m: DashboardMetrics) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [metrics, setMetricsState] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  const setUser = useCallback((u: User | null) => setUserState(u), []);
  const setMetrics = useCallback((m: DashboardMetrics) => setMetricsState(m), []);

  const clearLocalSession = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setMetricsState(DEFAULT_METRICS);
    queryClient.clear();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    try {
      const tokens = await api.auth.refresh();
      setAccessToken(tokens.access_token);
      const current = await api.me.get();
      setUserState(current);
      return current;
    } catch {
      clearLocalSession();
      return null;
    }
  }, [clearLocalSession]);

  const signout = useCallback(() => {
    clearLocalSession();
    void api.auth.logout().catch(() => {
      /* ignore */
    });
  }, [clearLocalSession]);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window === "undefined") {
      finish();
      return;
    }

    const cached = window.localStorage.getItem(USER_KEY);
    const token = getAccessToken();
    if (cached && token) {
      try {
        setUserState(JSON.parse(cached) as User);
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }

    const hydrate = async () => {
      if (token) {
        try {
          const current = await api.me.get();
          if (!cancelled) setUserState(current);
          return;
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 401)) {
            clearLocalSession();
            return;
          }
        }
      }
      await refreshSession();
    };

    void hydrate().finally(finish);

    return () => {
      cancelled = true;
    };
  }, [clearLocalSession, refreshSession]);

  // Persist user.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }

    const displayPreferences = displayPreferencesFromUser(user);
    applyDisplayPreferences(displayPreferences);
    return watchAutoThemePreference(displayPreferences);
  }, [user]);

  // Auto-refresh metrics so the topbar stays current after a task completes.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const dash = await api.me.dashboard();
        if (!cancelled) setMetricsState(dash.metrics);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) signout();
      }
    };
    void load();
    const onCompleted = () => {
      void load();
    };
    window.addEventListener("storyteller:task-completed", onCompleted);
    return () => {
      cancelled = true;
      window.removeEventListener("storyteller:task-completed", onCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signin = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    setAccessToken(res.access_token);
    setUserState(res.user);
    return res.user;
  }, []);

  const signup = useCallback(
    async (data: {
      first_name: string;
      last_name: string;
      email: string;
      password: string;
      year_of_birth: number;
    }) => {
      const res = await api.auth.signup(data);
      setAccessToken(res.access_token);
      setUserState(res.user);
      return res.user;
    },
    []
  );

  const signinGoogle = useCallback(
    async (returnTo = "/dashboard", intent: "login" | "signup" = "login") => {
      if (!isUsingMock && typeof window !== "undefined") {
        window.location.assign(api.auth.googleStartUrl(returnTo, intent));
        return await new Promise<User>(() => {
          /* browser is navigating away */
        });
      }
      const res = await api.auth.google();
      setAccessToken(res.access_token);
      setUserState(res.user);
      return res.user;
    },
    []
  );

  const setInterests = useCallback(async (ids: InterestId[]) => {
    await api.me.setInterests(ids);
    setUserState((prev) => (prev ? { ...prev, interests: ids } : prev));
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["me", "dashboard"] });
  }, [queryClient]);

  const completeOnboarding = useCallback(async (data: CompleteOnboardingRequest) => {
    const updated = await api.me.completeOnboarding(data);
    setUserState(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      metrics,
      ready,
      signin,
      signup,
      signinGoogle,
      refreshSession,
      signout,
      setUser,
      setInterests,
      completeOnboarding,
      setMetrics,
    }),
    [
      user,
      metrics,
      ready,
      signin,
      signup,
      signinGoogle,
      refreshSession,
      signout,
      setUser,
      setInterests,
      completeOnboarding,
      setMetrics,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
