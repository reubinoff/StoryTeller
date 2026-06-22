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
  english_level_at_roll: 24,
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
      within(activeRow as HTMLElement).getByRole("button", { name: /resume/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-active");

    fireEvent.click(
      within(completedRow as HTMLElement).getByRole("button", {
        name: /view result/i,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-done/result");
  });

  it("routes writing processing, retry, and failed statuses to the right screens", () => {
    mockTaskList.data = {
      items: [
        task({
          id: "writing-processing",
          course_id: "writing",
          course_type: "short_writing",
          title: "Feedback Pending",
          status: "processing",
        }),
        task({
          id: "writing-retry",
          course_id: "writing",
          course_type: "short_writing",
          title: "Needs More Detail",
          status: "needs_retry",
        }),
        task({
          id: "writing-failed",
          course_id: "writing",
          course_type: "short_writing",
          title: "Feedback Failed",
          status: "failed",
          failed_at: "2026-06-02T10:00:00Z",
        }),
      ],
      next_cursor: null,
    };

    render(<TasksRoute />);

    const processingRow = screen.getByText("Feedback Pending").closest("article");
    const retryRow = screen.getByText("Needs More Detail").closest("article");
    const failedRow = screen.getByText("Feedback Failed").closest("article");

    fireEvent.click(
      within(processingRow as HTMLElement).getByRole("button", {
        name: /check status/i,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/writing-processing");

    fireEvent.click(
      within(retryRow as HTMLElement).getByRole("button", { name: /try again/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/writing-retry/result");

    fireEvent.click(
      within(failedRow as HTMLElement).getByRole("button", { name: /review/i }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/writing-failed/result");
  });

  it("shows loading, error, and empty states", () => {
    mockTaskList = {
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    };

    const { rerender } = render(<TasksRoute />);

    expect(screen.getByLabelText("Loading tasks")).toBeInTheDocument();

    const refetch = vi.fn();
    mockTaskList = {
      isLoading: false,
      isError: true,
      refetch,
    };
    rerender(<TasksRoute />);

    expect(screen.getByText("Tasks could not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(refetch).toHaveBeenCalled();

    mockTaskList = {
      isLoading: false,
      isError: false,
      data: { items: [], next_cursor: null },
      refetch: vi.fn(),
    };
    rerender(<TasksRoute />);

    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /new task/i })[1]);
    expect(mockNavigate).toHaveBeenCalledWith("/courses");
  });

  it("sorts tasks by newest update and summarizes task stats", () => {
    mockTaskList.data = {
      items: [
        task({
          id: "old-failed",
          title: "Old Failed",
          status: "failed",
          updated_at: "2026-06-01T10:00:00Z",
          failed_at: "2026-06-01T10:00:00Z",
        }),
        task({
          id: "new-completed",
          title: "New Completed",
          status: "completed",
          score: 90,
          completed_at: "2026-06-03T10:00:00Z",
          updated_at: "2026-06-03T10:00:00Z",
        }),
        task({
          id: "middle-active",
          title: "Middle Active",
          status: "processing",
          updated_at: "2026-06-02T10:00:00Z",
        }),
        task({
          id: "older-completed",
          title: "Older Completed",
          status: "completed",
          score: 70,
          completed_at: "2026-05-31T10:00:00Z",
          updated_at: "2026-05-31T10:00:00Z",
        }),
      ],
      next_cursor: null,
    };

    render(<TasksRoute />);

    expect(taskStat("Active")).toHaveTextContent("1");
    expect(taskStat("Completed")).toHaveTextContent("2");
    expect(taskStat("Average score")).toHaveTextContent("80%");
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "New Completed",
      "Middle Active",
      "Old Failed",
      "Older Completed",
    ]);
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

    fireEvent.click(screen.getByRole("button", { name: "Failed" }));

    expect(screen.getByText("No failed tasks")).toBeInTheDocument();
  });
});

function taskStat(label: string): HTMLElement {
  const labelNode = Array.from(
    document.querySelectorAll(".task-stat-label"),
  ).find((node) => node.textContent === label);
  const stat = labelNode?.closest(".task-stat");
  if (!stat) throw new Error(`No task stat found for ${label}`);
  return stat as HTMLElement;
}
