/**
 * Typed API client for Storyteller.
 *
 * Uses fetch() against VITE_API_BASE_URL when configured, otherwise /api/v1.
 */

import type { Problem } from "./types";

const CSRF_COOKIE = "st_csrf";
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

export function getCookie(name: string): string | null {
  if (typeof window === "undefined") return null;
  const prefix = `${name}=`;
  const raw = window.document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!raw) return null;
  try {
    return decodeURIComponent(raw.slice(prefix.length));
  } catch {
    return raw.slice(prefix.length);
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
  /** Skips 401 refresh retry (used for /auth/* endpoints). */
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

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function requestHeaders(method: string, body: unknown): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (!isFormData(body)) headers["Content-Type"] = "application/json";
  const csrf = getCookie(CSRF_COOKIE);
  if (csrf && isUnsafeMethod(method)) headers["X-CSRF-Token"] = csrf;
  return headers;
}

function requestBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (isFormData(body)) return body;
  return JSON.stringify(body);
}

function fallbackProblem(res: Response, code = "request_failed"): Problem {
  return {
    type: "about:blank",
    title: res.statusText || "Request failed",
    status: res.status,
    code,
  };
}

async function readJsonOrNull(res: Response): Promise<unknown | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return fallbackProblem(res, "invalid_response");
  }
}

function asProblem(res: Response, json: unknown | null): Problem {
  if (
    json &&
    typeof json === "object" &&
    "status" in json &&
    "title" in json &&
    "code" in json
  ) {
    return json as Problem;
  }
  return fallbackProblem(res);
}

async function refreshCookies(): Promise<boolean> {
  const res = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    headers: requestHeaders("POST", undefined),
    credentials: "include",
  });
  return res.ok;
}

async function fetchOnce<TBody>(
  path: string,
  {
    method,
    body,
    query,
  }: Pick<Required<RequestOptions<TBody>>, "method"> &
    Pick<RequestOptions<TBody>, "body" | "query">
): Promise<Response> {
  const url = buildUrl(path, query);
  return fetch(`${apiBase}${url}`, {
    method,
    headers: requestHeaders(method, body),
    body: requestBody(body),
    credentials: "include",
  });
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

  let res = await fetchOnce(path, {
    method,
    body,
    query,
  });

  if (!noAuth && res.status === 401) {
    const refreshed = await refreshCookies();
    if (refreshed) {
      res = await fetchOnce(path, { method, body, query });
    }
  }

  if (res.status === 204) return undefined as unknown as TResponse;

  const json = await readJsonOrNull(res);

  if (!res.ok) {
    const problem = asProblem(res, json);
    if (!noAuth && res.status === 401) notifyUnauthorized(url);
    if (throwOnError) throw new ApiError(problem);
    return problem as unknown as TResponse;
  }
  return json as TResponse;
}
