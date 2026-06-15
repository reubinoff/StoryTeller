/**
 * Auth context: keeps the active user in memory while cookies own the session.
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
import { UNAUTHORIZED_EVENT } from "./api/client";
import { api } from "./api/endpoints";
import {
  applyDisplayPreferences,
  displayPreferencesFromUser,
  watchAutoThemePreference,
} from "./display-preferences";
import type {
  CompleteOnboardingRequest,
  InterestId,
  User,
} from "./api/types";

interface AuthContextValue {
  user: User | null;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();

  const setUser = useCallback((u: User | null) => setUserState(u), []);

  const clearLocalSession = useCallback(() => {
    setUserState(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshSession = useCallback(async () => {
    try {
      await api.auth.refresh();
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onUnauthorized = () => clearLocalSession();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [clearLocalSession]);

  // Hydrate from backend-managed cookies on mount.
  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window === "undefined") {
      finish();
      return;
    }

    const hydrate = async () => {
      const current = await refreshSession();
      if (!cancelled) setUserState(current);
    };

    void hydrate().finally(finish);

    return () => {
      cancelled = true;
    };
  }, [clearLocalSession, refreshSession]);

  useEffect(() => {
    const displayPreferences = displayPreferencesFromUser(user);
    applyDisplayPreferences(displayPreferences);
    return watchAutoThemePreference(displayPreferences);
  }, [user]);

  const signin = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
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
      setUserState(res.user);
      return res.user;
    },
    []
  );

  const signinGoogle = useCallback(
    async (returnTo = "/dashboard", intent: "login" | "signup" = "login") => {
      if (typeof window !== "undefined") {
        window.location.assign(api.auth.googleStartUrl(returnTo, intent));
        return await new Promise<User>(() => {
          /* browser is navigating away */
        });
      }
      return await new Promise<User>(() => {
        /* Google sign-in is only available in the browser. */
      });
    },
    []
  );

  const setInterests = useCallback(async (ids: InterestId[]) => {
    await api.me.setInterests(ids);
    setUserState((prev) => (prev ? { ...prev, interests: ids } : prev));
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    void queryClient.invalidateQueries({ queryKey: ["me", "dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["me", "metrics"] });
  }, [queryClient]);

  const completeOnboarding = useCallback(async (data: CompleteOnboardingRequest) => {
    const updated = await api.me.completeOnboarding(data);
    setUserState(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      signin,
      signup,
      signinGoogle,
      refreshSession,
      signout,
      setUser,
      setInterests,
      completeOnboarding,
    }),
    [
      user,
      ready,
      signin,
      signup,
      signinGoogle,
      refreshSession,
      signout,
      setUser,
      setInterests,
      completeOnboarding,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
}
