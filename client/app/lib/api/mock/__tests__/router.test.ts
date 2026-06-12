import { describe, it, expect } from "vitest";
import { pathParts, ok, err } from "../router";

describe("pathParts", () => {
  it("returns the full path when no query string", () => {
    const { pathname, query } = pathParts("/auth/login");
    expect(pathname).toBe("/auth/login");
    expect([...query.entries()]).toHaveLength(0);
  });

  it("splits path and query string", () => {
    const { pathname, query } = pathParts("/tasks?status=in_progress&limit=10");
    expect(pathname).toBe("/tasks");
    expect(query.get("status")).toBe("in_progress");
    expect(query.get("limit")).toBe("10");
  });

  it("handles path with no leading slash", () => {
    const { pathname } = pathParts("me/dashboard");
    expect(pathname).toBe("me/dashboard");
  });

  it("handles empty query string", () => {
    const { pathname, query } = pathParts("/courses?");
    expect(pathname).toBe("/courses");
    expect([...query.entries()]).toHaveLength(0);
  });
});

describe("ok", () => {
  it("wraps primitive data", () => {
    const res = ok(42);
    expect(res.kind).toBe("ok");
    expect(res.data).toBe(42);
  });

  it("wraps object data", () => {
    const res = ok({ id: "abc", email: "test@test.com" });
    expect(res.kind).toBe("ok");
    expect(res.data).toEqual({ id: "abc", email: "test@test.com" });
  });

  it("wraps null", () => {
    const res = ok(null);
    expect(res.kind).toBe("ok");
    expect(res.data).toBeNull();
  });
});

describe("err", () => {
  it("builds a correctly shaped error response", () => {
    const res = err(401, "unauthenticated", "Not authenticated", "Token expired");
    expect(res.kind).toBe("error");
    expect(res.problem.status).toBe(401);
    expect(res.problem.code).toBe("unauthenticated");
    expect(res.problem.title).toBe("Not authenticated");
    expect(res.problem.detail).toBe("Token expired");
  });

  it("omits detail when not provided", () => {
    const res = err(404, "not_found", "Not Found");
    expect(res.problem.detail).toBeUndefined();
  });

  it("includes field-level errors when provided", () => {
    const fieldErrors = [
      { field: "email", message: "Invalid format" },
      { field: "password", message: "Too short" },
    ];
    const res = err(422, "validation_error", "Validation Failed", undefined, fieldErrors);
    expect(res.problem.errors).toHaveLength(2);
    expect(res.problem.errors![0].field).toBe("email");
    expect(res.problem.errors![1].field).toBe("password");
  });

  it("generates a typed error URL", () => {
    const res = err(409, "email_taken", "Email taken");
    expect(res.problem.type).toContain("email_taken");
  });
});
