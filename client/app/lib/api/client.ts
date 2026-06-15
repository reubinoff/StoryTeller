/**
 * Typed API client for Storyteller.
 *
 * Uses fetch() against VITE_API_BASE_URL when configured, otherwise /api/v1.
 */

import type { Problem } from "./types";

const ACCESS_TOKEN_KEY = "storyteller.auth.accessToken";
export const UNAUTHORIZED_EVENT = "storyteller:auth:unauthorized";

export interface UnauthorizedEventDetail {
  path: string;
  status: 401;
}

const apiBase =
  (typeof import.meta !== "undefined" && import.meta.env.VITE_API_BASE_URL) ||
  "/api/v1";

export class ApiError extends Error {
  problem: Problem;
  status: number;
  constructor(problem: Problem) {
    super(problem.detail || problem.title);
    this.problem = problem;
    this.status = problem.status;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    /* Storage can be unavailable in private or embedded browser contexts. */
  }
}

export function notifyUnauthorized(path: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UnauthorizedEventDetail>(UNAUTHORIZED_EVENT, {
      detail: { path, status: 401 },
    })
  );
}

export interface RequestOptions<TBody = unknown> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: TBody;
  /** Skips auth header attachment (used for /auth/* endpoints). */
  noAuth?: boolean;
  query?: Record<string, string | number | undefined | null>;
  /** When true, doesn't throw on non-2xx; returns the typed Problem. */
  throwOnError?: boolean;
}

export function buildUrl(
  path: string,
  query?: RequestOptions["query"]
): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.set(k, String(v));
    });
    const qs = params.toString();
    if (qs) p += `?${qs}`;
  }
  return p;
}

export function apiUrl(path: string, query?: RequestOptions["query"]): string {
  return `${apiBase}${buildUrl(path, query)}`;
}

export async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    noAuth = false,
    query,
    throwOnError = true,
  } = options;
  const url = buildUrl(path, query);

  const token = noAuth ? null : getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 204) return undefined as unknown as TResponse;

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const problem =
      (json as Problem | null) || {
        type: "about:blank",
        title: res.statusText || "Request failed",
        status: res.status,
        code: "request_failed",
      };
    if (!noAuth && res.status === 401) notifyUnauthorized(url);
    if (throwOnError) throw new ApiError(problem);
    return problem as unknown as TResponse;
  }
  return json as TResponse;
}
