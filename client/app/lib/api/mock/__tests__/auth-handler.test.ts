import { describe, it, expect, beforeEach } from "vitest";
import { reset } from "../db";
import { handleAuth } from "../handlers/auth";
import type { MockRequest } from "../router";
import type { AuthResponse } from "../../types";

function req(
  method: MockRequest["method"],
  url: string,
  body?: unknown
): MockRequest {
  return { method, url, body, token: null };
}

beforeEach(() => {
  reset();
  localStorage.clear();
});

describe("signup", () => {
  const validBody = {
    first_name: "Alice",
    last_name: "Smith",
    email: "alice@test.com",
    password: "secret123",
    year_of_birth: 2010,
  };

  it("creates a user and returns a token for valid data", () => {
    const res = handleAuth(req("POST", "/auth/signup", validBody));
    expect(res?.kind).toBe("ok");
    const data = (res as { kind: "ok"; data: AuthResponse }).data;
    expect(data.user.email).toBe("alice@test.com");
    expect(data.user.first_name).toBe("Alice");
    expect(data.access_token).toMatch(/^mock\./);
    expect(data.expires_in).toBeGreaterThan(0);
  });

  it("lowercases the email on signup", () => {
    const res = handleAuth(req("POST", "/auth/signup", { ...validBody, email: "ALICE@Test.COM" }));
    expect(res?.kind).toBe("ok");
    const data = (res as { kind: "ok"; data: AuthResponse }).data;
    expect(data.user.email).toBe("alice@test.com");
  });

  it("derives grade_level from year_of_birth", () => {
    const currentYear = new Date().getFullYear();
    const yob = currentYear - 11; // age 11 → grade 6
    const res = handleAuth(req("POST", "/auth/signup", { ...validBody, year_of_birth: yob }));
    expect(res?.kind).toBe("ok");
    const data = (res as { kind: "ok"; data: AuthResponse }).data;
    expect(data.user.grade_level).toBeGreaterThanOrEqual(1);
    expect(data.user.grade_level).toBeLessThanOrEqual(12);
  });

  it("returns 409 for a duplicate email", () => {
    handleAuth(req("POST", "/auth/signup", validBody));
    const res = handleAuth(req("POST", "/auth/signup", validBody));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") {
      expect(res.problem.status).toBe(409);
      expect(res.problem.code).toBe("email_taken");
    }
  });

  it("is case-insensitive for duplicate detection", () => {
    handleAuth(req("POST", "/auth/signup", validBody));
    const res = handleAuth(req("POST", "/auth/signup", { ...validBody, email: "ALICE@TEST.COM" }));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") expect(res.problem.status).toBe(409);
  });

  it("returns 422 when required fields are missing", () => {
    const res = handleAuth(req("POST", "/auth/signup", { email: "x@x.com" }));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") expect(res.problem.status).toBe(422);
  });

  it("returns 422 for empty body", () => {
    const res = handleAuth(req("POST", "/auth/signup", {}));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") expect(res.problem.status).toBe(422);
  });
});

describe("login", () => {
  const signupBody = {
    first_name: "Bob",
    last_name: "Jones",
    email: "bob@test.com",
    password: "pass",
    year_of_birth: 2008,
  };

  beforeEach(() => {
    handleAuth(req("POST", "/auth/signup", signupBody));
  });

  it("returns a token for a registered email", () => {
    const res = handleAuth(req("POST", "/auth/login", { email: "bob@test.com", password: "anything" }));
    expect(res?.kind).toBe("ok");
    const data = (res as { kind: "ok"; data: AuthResponse }).data;
    expect(data.user.email).toBe("bob@test.com");
    expect(data.access_token).toMatch(/^mock\./);
  });

  it("is case-insensitive for email lookup", () => {
    const res = handleAuth(req("POST", "/auth/login", { email: "BOB@TEST.COM", password: "x" }));
    expect(res?.kind).toBe("ok");
  });

  it("returns 401 for an unknown email", () => {
    const res = handleAuth(req("POST", "/auth/login", { email: "nobody@test.com", password: "pass" }));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") {
      expect(res.problem.status).toBe(401);
      expect(res.problem.code).toBe("invalid_credentials");
    }
  });

  it("returns 422 for missing credentials", () => {
    const res = handleAuth(req("POST", "/auth/login", {}));
    expect(res?.kind).toBe("error");
    if (res?.kind === "error") expect(res.problem.status).toBe(422);
  });
});

describe("google exchange", () => {
  it("creates the demo Maya account on first call", () => {
    const res = handleAuth(req("POST", "/auth/google/exchange"));
    expect(res?.kind).toBe("ok");
    const data = (res as { kind: "ok"; data: AuthResponse }).data;
    expect(data.user.email).toBe("maya@example.com");
    expect(data.user.first_name).toBe("Maya");
  });

  it("returns the same user on subsequent calls", () => {
    const res1 = handleAuth(req("POST", "/auth/google/exchange"));
    const res2 = handleAuth(req("POST", "/auth/google/exchange"));
    expect(res1?.kind).toBe("ok");
    expect(res2?.kind).toBe("ok");
    const u1 = (res1 as { kind: "ok"; data: AuthResponse }).data.user.id;
    const u2 = (res2 as { kind: "ok"; data: AuthResponse }).data.user.id;
    expect(u1).toBe(u2);
  });
});

describe("logout", () => {
  it("returns ok with null data", () => {
    const res = handleAuth(req("POST", "/auth/logout"));
    expect(res?.kind).toBe("ok");
  });
});

describe("unmatched routes", () => {
  it("returns null for non-auth paths", () => {
    expect(handleAuth(req("GET", "/me"))).toBeNull();
    expect(handleAuth(req("GET", "/courses"))).toBeNull();
    expect(handleAuth(req("POST", "/tasks/123/start"))).toBeNull();
  });

  it("returns null for unsupported auth methods", () => {
    expect(handleAuth(req("GET", "/auth/login"))).toBeNull();
  });
});
