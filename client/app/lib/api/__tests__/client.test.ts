import { describe, it, expect, beforeEach } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "../client";

describe("getAccessToken / setAccessToken", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("stores and retrieves a token", () => {
    setAccessToken("tok-abc123");
    expect(getAccessToken()).toBe("tok-abc123");
  });

  it("removes the token when passed null", () => {
    setAccessToken("tok-abc123");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("overwrites a previously stored token", () => {
    setAccessToken("old-token");
    setAccessToken("new-token");
    expect(getAccessToken()).toBe("new-token");
  });
});

describe("ApiError", () => {
  it("uses detail as message when provided", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      code: "bad_request",
      detail: "Email is invalid",
    });
    expect(err.message).toBe("Email is invalid");
    expect(err.status).toBe(400);
    expect(err.problem.code).toBe("bad_request");
  });

  it("falls back to title when detail is absent", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "not_found",
    });
    expect(err.message).toBe("Not Found");
    expect(err.status).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new ApiError({
      type: "about:blank",
      title: "Server Error",
      status: 500,
      code: "server_error",
    });
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes the full problem object", () => {
    const problem = {
      type: "about:blank",
      title: "Validation Failed",
      status: 422,
      code: "validation_error",
      errors: [{ field: "email", message: "Invalid format" }],
    };
    const err = new ApiError(problem);
    expect(err.problem).toEqual(problem);
  });
});
