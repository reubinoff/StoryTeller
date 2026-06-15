import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ReadingSubmitResponse,
  WritingResult,
  WritingSubmitAccepted,
} from "../types";

const endpointMocks = vi.hoisted(() => ({
  result: vi.fn(),
  retry: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("../endpoints", () => ({
  api: {
    tasks: {
      result: endpointMocks.result,
      retry: endpointMocks.retry,
      submit: endpointMocks.submit,
    },
  },
}));

import {
  queryKeys,
  taskResultRefetchInterval,
  useRetryTask,
  useSubmitTask,
} from "../queries";

afterEach(() => {
  vi.useRealTimers();
});

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const readingSubmitResponse: ReadingSubmitResponse = {
  id: "task-1",
  user_id: "user-1",
  course_id: "reading",
  course_type: "unseen_text",
  interest_id: "space",
  grade_level_at_roll: 4,
  status: "completed",
  title: "Moon story",
  topic_label: "Space",
  score: 100,
  xp_awarded: 72,
  started_at: "2026-06-01T10:00:00Z",
  submitted_at: "2026-06-01T10:05:00Z",
  completed_at: "2026-06-01T10:05:00Z",
  failed_at: null,
  fail_reason: null,
  passed: true,
  passing_score: 70,
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:05:00Z",
  correct_count: 3,
  total: 3,
};

describe("useSubmitTask", () => {
  beforeEach(() => {
    endpointMocks.result.mockReset();
    endpointMocks.retry.mockReset();
    endpointMocks.submit.mockReset();
  });

  it("caches full reading submit responses by task id", async () => {
    const queryClient = makeClient();
    endpointMocks.submit.mockResolvedValue(readingSubmitResponse);
    const { result } = renderHook(() => useSubmitTask(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        taskId: "task-1",
        body: { answers: [] },
      });
    });

    expect(queryClient.getQueryData(queryKeys.task("task-1"))).toEqual(
      readingSubmitResponse
    );
  });

  it("invalidates the task query for accepted writing submits", async () => {
    const queryClient = makeClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const accepted: WritingSubmitAccepted = {
      id: "task-1",
      status: "processing",
      submitted_at: "2026-06-01T10:05:00Z",
    };
    endpointMocks.submit.mockResolvedValue(accepted);
    const { result } = renderHook(() => useSubmitTask(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        taskId: "task-1",
        body: { full_text: "A complete answer." },
      });
    });

    expect(queryClient.getQueryData(queryKeys.task("task-1"))).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task("task-1"),
    });
  });

  it("invalidates task state when submit fails after changing server state", async () => {
    const queryClient = makeClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    endpointMocks.submit.mockRejectedValue(new Error("queue down"));
    const { result } = renderHook(() => useSubmitTask(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          taskId: "task-1",
          body: { full_text: "A complete answer." },
        })
      ).rejects.toThrow("queue down");
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task("task-1"),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard });
  });
});

describe("useTaskResult", () => {
  beforeEach(() => {
    endpointMocks.result.mockReset();
  });

  it("polls while a writing result is still processing", () => {
    const processing: WritingResult = {
      task_id: "task-1",
      mode: "writing",
      status: "processing",
      answer_text: "Draft",
      evaluation: null,
      fail_reason: null,
      xp_earned: 0,
      passed: null,
      passing_score: 70,
      next_task: null,
      submitted_at: "2026-06-01T10:05:00Z",
      completed_at: null,
    };

    expect(taskResultRefetchInterval(processing)).toBe(5000);
    expect(
      taskResultRefetchInterval({ ...processing, status: "submitted" })
    ).toBe(5000);
    expect(
      taskResultRefetchInterval({ ...processing, status: "failed" })
    ).toBe(false);
    expect(
      taskResultRefetchInterval({ ...processing, status: "completed" })
    ).toBe(false);
    expect(taskResultRefetchInterval(undefined)).toBe(false);
  });
});

describe("useRetryTask", () => {
  beforeEach(() => {
    endpointMocks.retry.mockReset();
  });

  it("invalidates task, result, list, and dashboard queries", async () => {
    const queryClient = makeClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    endpointMocks.retry.mockResolvedValue({
      id: "task-1",
      status: "processing",
      submitted_at: "2026-06-01T10:05:00Z",
    });
    const { result } = renderHook(() => useRetryTask(), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("task-1");
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.task("task-1"),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.result("task-1"),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard });
  });
});
