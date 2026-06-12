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
import { ApiError, getAccessToken, setAccessToken } from "./api/client";
import { api } from "./api/endpoints";
import type { DashboardMetrics, InterestId, User } from "./api/types";

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
  signinGoogle: () => Promise<User>;
  signout: () => void;
  setUser: (u: User | null) => void;
  setInterests: (ids: InterestId[]) => Promise<void>;
  setMetrics: (m: DashboardMetrics) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [metrics, setMetricsState] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") {
      setReady(true);
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
    setReady(true);
  }, []);

  // Persist user.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
      // Apply user display preferences to <body>.
      document.body.dataset.theme =
        user.theme_preference === "auto" ? "default" : user.theme_preference;
      document.body.dataset.textSize = user.text_size_preference;
      document.body.dataset.reduceMotion = user.reduce_motion ? "true" : "false";
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
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

  const setUser = useCallback((u: User | null) => setUserState(u), []);
  const setMetrics = useCallback((m: DashboardMetrics) => setMetricsState(m), []);

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

  const signinGoogle = useCallback(async () => {
    const res = await api.auth.google();
    setAccessToken(res.access_token);
    setUserState(res.user);
    return res.user;
  }, []);

  const signout = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setMetricsState(DEFAULT_METRICS);
    void api.auth.logout().catch(() => {
      /* ignore */
    });
  }, []);

  const setInterests = useCallback(async (ids: InterestId[]) => {
    await api.me.setInterests(ids);
    setUserState((prev) => (prev ? { ...prev, interests: ids } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      metrics,
      ready,
      signin,
      signup,
      signinGoogle,
      signout,
      setUser,
      setInterests,
      setMetrics,
    }),
    [
      user,
      metrics,
      ready,
      signin,
      signup,
      signinGoogle,
      signout,
      setUser,
      setInterests,
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
