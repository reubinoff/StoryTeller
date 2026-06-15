import type {
  AdminAuditEvent,
  AdminOverview,
  AdminSession,
  AdminUserDetail,
  AdminUserSummary,
  AuthResponse,
  LoginRequest,
  Page,
  Problem,
  UserRole,
  UserStatus,
} from "./types";

const CSRF_COOKIE = "st_csrf";
const CSRF_HEADER = "X-CSRF-Token";

const apiBase =
  (typeof import.meta !== "undefined" && import.meta.env.VITE_API_BASE_URL) ||
  "/api/v1";

let cachedCsrfToken: string | null = null;

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

export function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined | null>
): string {
  let url = path.startsWith("/") ? path : `/${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

export function apiUrl(
  path: string,
  query?: Record<string, string | number | undefined | null>
): string {
  return `${apiBase}${buildUrl(path, query)}`;
}

function isUnsafe(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function headers(method: string, body: unknown): Record<string, string> {
  const csrf = cachedCsrfToken ?? getCookie(CSRF_COOKIE);
  const next: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) next["Content-Type"] = "application/json";
  if (csrf && isUnsafe(method)) next[CSRF_HEADER] = csrf;
  return next;
}

function captureCsrf(res: Response): void {
  const csrf = res.headers.get(CSRF_HEADER);
  if (csrf) cachedCsrfToken = csrf;
}

async function readJson(res: Response): Promise<unknown | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      type: "about:blank",
      title: res.statusText || "Request failed",
      status: res.status,
      code: "invalid_response",
    } satisfies Problem;
  }
}

function asProblem(res: Response, payload: unknown | null): Problem {
  if (
    payload &&
    typeof payload === "object" &&
    "status" in payload &&
    "title" in payload &&
    "code" in payload
  ) {
    return payload as Problem;
  }
  return {
    type: "about:blank",
    title: res.statusText || "Request failed",
    status: res.status,
    code: "request_failed",
  };
}

async function refreshCookies(): Promise<boolean> {
  const res = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST",
    headers: headers("POST", undefined),
    credentials: "include",
  });
  captureCsrf(res);
  return res.ok;
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | undefined | null>;
    noAuth?: boolean;
  } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const runFetch = () =>
    fetch(apiUrl(path, options.query), {
      method,
      headers: headers(method, options.body),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
    });

  let res = await runFetch();
  captureCsrf(res);

  if (!options.noAuth && res.status === 401 && (await refreshCookies())) {
    res = await runFetch();
    captureCsrf(res);
  }

  if (res.status === 204) return undefined as T;
  const payload = await readJson(res);
  if (!res.ok) throw new ApiError(asProblem(res, payload));
  return payload as T;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<AuthResponse>("/auth/login", { method: "POST", body, noAuth: true }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    googleStartUrl: (returnTo = "/") =>
      apiUrl("/auth/google/start", {
        return_to: returnTo,
        intent: "login",
        surface: "admin",
      }),
  },
  admin: {
    session: () => request<AdminSession>("/admin/session"),
    overview: (rangeDays: 7 | 30 | 90) =>
      request<AdminOverview>("/admin/overview", {
        query: { range_days: rangeDays },
      }),
    users: (params: {
      query?: string;
      role?: UserRole | "";
      status?: UserStatus | "";
      limit?: number;
      cursor?: string | null;
    }) => request<Page<AdminUserSummary>>("/admin/users", { query: params }),
    user: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),
    setAdmin: (id: string, isAdmin: boolean) =>
      request<AdminUserDetail>(`/admin/users/${id}/admin`, {
        method: "PATCH",
        body: { is_admin: isAdmin },
      }),
    setStatus: (id: string, status: "active" | "suspended") =>
      request<AdminUserDetail>(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    audit: (params: { target_user_id?: string; limit?: number; cursor?: string | null }) =>
      request<Page<AdminAuditEvent>>("/admin/audit", { query: params }),
  },
};
