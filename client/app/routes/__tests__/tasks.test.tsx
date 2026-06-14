import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TasksRoute from "../tasks";
import type { Task } from "~/lib/api/types";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

let mockTaskList: {
  isLoading: boolean;
  isError: boolean;
  data?: { items: Task[]; next_cursor: null };
  refetch: ReturnType<typeof vi.fn>;
};

vi.mock("~/lib/api/queries", () => ({
  useTaskList: () => mockTaskList,
}));

const task = (overrides: Partial<Task>): Task => ({
  id: "task-1",
  user_id: "user-1",
  course_id: "reading",
  course_type: "unseen_text",
  interest_id: "space",
  grade_level_at_roll: 4,
  status: "in_progress",
  title: "Lost Moon",
  topic_label: "Space",
  score: null,
  xp_awarded: 0,
  started_at: "2026-06-01T10:00:00Z",
  submitted_at: null,
  completed_at: null,
  failed_at: null,
  fail_reason: null,
  passed: null,
  passing_score: 70,
  created_at: "2026-06-01T09:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  ...overrides,
});

describe("TasksRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockTaskList = {
      isLoading: false,
      isError: false,
      data: { items: [], next_cursor: null },
      refetch: vi.fn(),
    };
  });

  it("opens active tasks directly and completed tasks on their result page", () => {
    mockTaskList.data = {
      items: [
        task({ id: "task-active", title: "Lost Moon", status: "in_progress" }),
        task({
          id: "task-done",
          title: "Garden Story",
          status: "completed",
          completed_at: "2026-06-02T10:00:00Z",
          updated_at: "2026-06-02T10:00:00Z",
          score: 92,
        }),
      ],
      next_cursor: null,
    };

    render(<TasksRoute />);

    const activeRow = screen.getByText("Lost Moon").closest("article");
    const completedRow = screen.getByText("Garden Story").closest("article");

    expect(activeRow).not.toBeNull();
    expect(completedRow).not.toBeNull();

    fireEvent.click(
      within(activeRow as HTMLElement).getByRole("button", { name: /resume/i })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-active");

    fireEvent.click(
      within(completedRow as HTMLElement).getByRole("button", {
        name: /view result/i,
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-done/result");
  });

  it("filters the task history by completion state", () => {
    mockTaskList.data = {
      items: [
        task({ id: "task-active", title: "Lost Moon", status: "in_progress" }),
        task({
          id: "task-done",
          title: "Garden Story",
          status: "completed",
          score: 92,
        }),
      ],
      next_cursor: null,
    };

    render(<TasksRoute />);

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));

    expect(screen.getByText("Garden Story")).toBeInTheDocument();
    expect(screen.queryByText("Lost Moon")).not.toBeInTheDocument();
  });
});
