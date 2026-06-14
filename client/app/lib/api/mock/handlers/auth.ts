import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  User,
} from "../../types";
import { commit, getState, uuid } from "../db";
import { err, ok, pathParts, type MockRequest, type MockResponse } from "../router";

const ACCESS_TOKEN_TTL = 900;

function deriveGrade(yearOfBirth: number): number {
  const age = new Date().getFullYear() - yearOfBirth;
  return Math.max(1, Math.min(12, age - 5));
}

function makeToken(userId: string): string {
  return `mock.${userId}.${Date.now().toString(36)}`;
}

function publicUser(u: User): User {
  // Strip any internal fields if we ever add them.
  return u;
}

function signin(user: User): AuthResponse {
  const state = getState();
  state.current_user_id = user.id;
  commit();
  return {
    access_token: makeToken(user.id),
    expires_in: ACCESS_TOKEN_TTL,
    user: publicUser(user),
  };
}

export function handleAuth(
  req: MockRequest
): MockResponse<unknown> | null {
  const { pathname } = pathParts(req.url);
  if (!pathname.startsWith("/auth/")) return null;
  const state = getState();

  if (req.method === "POST" && pathname === "/auth/signup") {
    const body = req.body as SignupRequest;
    if (
      !body?.first_name ||
      !body?.last_name ||
      !body?.email ||
      !body?.password ||
      !body?.year_of_birth
    ) {
      return err(422, "validation_error", "Validation failed");
    }
    const existing = Object.values(state.users).find(
      (u) => u.email.toLowerCase() === body.email.toLowerCase()
    );
    if (existing) {
      return err(409, "email_taken", "Email already in use");
    }
    const user: User = {
      id: uuid(),
      email: body.email.toLowerCase(),
      email_verified: false,
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      year_of_birth: body.year_of_birth,
      grade_level: deriveGrade(body.year_of_birth),
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
      created_at: new Date().toISOString(),
      onboarding_completed: false,
    };
    state.users[user.id] = user;
    state.user_tasks[user.id] = [];
    state.notifications[user.id] = [];
    commit();
    return ok(signin(user));
  }

  if (req.method === "POST" && pathname === "/auth/login") {
    const body = req.body as LoginRequest;
    if (!body?.email || !body?.password) {
      return err(422, "validation_error", "Validation failed");
    }
    const user = Object.values(state.users).find(
      (u) => u.email.toLowerCase() === body.email.toLowerCase()
    );
    if (!user) {
      return err(401, "invalid_credentials", "Invalid email or password");
    }
    return ok(signin(user));
  }

  if (req.method === "POST" && pathname === "/auth/google/exchange") {
    // Demo: any payload signs in (or creates) a deterministic Maya account.
    const email = "maya@example.com";
    let user = Object.values(state.users).find((u) => u.email === email);
    if (!user) {
      user = {
        id: uuid(),
        email,
        email_verified: true,
        first_name: "Maya",
        last_name: "Patel",
        year_of_birth: 2017,
        grade_level: deriveGrade(2017),
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
        created_at: new Date().toISOString(),
        onboarding_completed: false,
      };
      state.users[user.id] = user;
      state.user_tasks[user.id] = [];
      state.notifications[user.id] = [];
      commit();
    }
    return ok(signin(user));
  }

  if (req.method === "POST" && pathname === "/auth/refresh") {
    if (!state.current_user_id) {
      return err(401, "unauthenticated", "No active session");
    }
    return ok({
      access_token: makeToken(state.current_user_id),
      expires_in: ACCESS_TOKEN_TTL,
    });
  }

  if (req.method === "POST" && pathname === "/auth/logout") {
    state.current_user_id = null;
    commit();
    return ok(null);
  }

  if (
    req.method === "POST" &&
    (pathname === "/auth/password/forgot" ||
      pathname === "/auth/password/reset" ||
      pathname === "/auth/email/verify/request" ||
      pathname === "/auth/email/verify/confirm")
  ) {
    return ok(null);
  }

  return null;
}
