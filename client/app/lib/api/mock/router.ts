import type { Problem } from "../types";
import { handleAuth } from "./handlers/auth";
import { handleCatalog } from "./handlers/catalog";
import { handleMe } from "./handlers/me";
import { handleTasks } from "./handlers/tasks";

export interface MockRequest<TBody = unknown> {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  url: string;
  body?: TBody;
  token: string | null;
}

export type MockResponse<T> =
  | { kind: "ok"; data: T }
  | { kind: "error"; problem: Problem };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HANDLERS: Array<
  (req: MockRequest) => MockResponse<unknown> | Promise<MockResponse<unknown>> | null
> = [handleAuth, handleCatalog, handleMe, handleTasks];

export async function mockHandle<TResponse, TBody = unknown>(
  req: MockRequest<TBody>
): Promise<MockResponse<TResponse>> {
  // Simulated network latency: a touch under half a second.
  await sleep(180 + Math.random() * 220);

  for (const h of HANDLERS) {
    const result = await h(req as MockRequest);
    if (result) return result as MockResponse<TResponse>;
  }
  return {
    kind: "error",
    problem: {
      type: "about:blank",
      title: "Not found",
      status: 404,
      code: "not_found",
      detail: `No mock handler matched ${req.method} ${req.url}`,
    },
  };
}

export function ok<T>(data: T): MockResponse<T> {
  return { kind: "ok", data };
}

export function err(
  status: number,
  code: string,
  title: string,
  detail?: string,
  errors?: Array<{ field: string; message: string }>
): MockResponse<never> {
  return {
    kind: "error",
    problem: {
      type: `https://errors.linguaquest.app/${code}`,
      title,
      status,
      detail,
      code,
      errors,
    },
  };
}

export function pathParts(url: string): { pathname: string; query: URLSearchParams } {
  const [path, search = ""] = url.split("?");
  return { pathname: path, query: new URLSearchParams(search) };
}
