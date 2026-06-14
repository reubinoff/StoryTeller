import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskResultRoute from "../task-result";
import type { ReadingResult, Task } from "~/lib/api/types";

const mockNavigate = vi.fn();
const mockRoll = vi.fn();
const mockRedo = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ taskId: "task-1" }),
  };
});

vi.mock("~/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/components/Toast")>();
  return { ...actual, useToast: () => ({ push: vi.fn() }) };
});

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: { first_name: "Maya" } }),
}));

let mockTask: Task;
let mockResult: ReadingResult;

vi.mock("~/lib/api/queries", () => ({
  useTask: () => ({ isLoading: false, data: mockTask }),
  useTaskResult: () => ({ isLoading: false, data: mockResult }),
  useRollTask: () => ({
    isPending: false,
    variables: undefined,
    mutateAsync: mockRoll,
  }),
  useRedoTask: () => ({
    isPending: false,
    mutateAsync: mockRedo,
  }),
}));

const baseTask: Task = {
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
};

const readingResult = (overrides: Partial<ReadingResult> = {}): ReadingResult => ({
  task_id: "task-1",
  mode: "reading",
  score: 3,
  total: 3,
  percentage: 100,
  duration_seconds: 120,
  xp_earned: 72,
  passed: true,
  passing_score: 70,
  questions: [
    {
      id: "q1",
      position: 1,
      question_type: "multiple_choice",
      prompt: "What happened?",
      options: ["A", "B"],
      correct_answer: "A",
      explanation: "Because the passage says so.",
      max_points: 1,
      user_answer: 0,
      is_correct: true,
    },
  ],
  ...overrides,
});

describe("TaskResultRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRoll.mockReset();
    mockRedo.mockReset();
    mockTask = baseTask;
    mockResult = readingResult();
  });

  it("opens the prepared next task after a passing reading result", async () => {
    mockRoll.mockResolvedValue({ id: "task-next", status: "not_started" });

    render(<TaskResultRoute />);

    expect(screen.getByText(/your next task is ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));

    await waitFor(() => {
      expect(mockRoll).toHaveBeenCalledWith({ courseId: "reading" });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-next");
    });
  });

  it("redos the same task after a below-threshold reading result", async () => {
    mockResult = readingResult({
      score: 1,
      percentage: 33,
      passed: false,
      xp_earned: 0,
      questions: [
        {
          ...readingResult().questions[0],
          user_answer: 1,
          is_correct: false,
        },
      ],
    });
    mockRedo.mockResolvedValue({ id: "task-1", status: "not_started" });

    render(<TaskResultRoute />);

    expect(screen.getByText(/you need 70% to move on/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockRedo).toHaveBeenCalledWith("task-1");
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-1");
    });
  });
});
