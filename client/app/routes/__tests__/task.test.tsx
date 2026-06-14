import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskRoute from "../task";
import type { Task } from "~/lib/api/types";

const mockNavigate = vi.fn();
const mockStart = vi.fn();
const mockAnswer = vi.fn();
const mockSubmit = vi.fn();
const mockSaveDraft = vi.fn();

let mockTaskId = "task-1";
let mockTask: Task;
let mockTaskLoading = false;
let mockSubmitPending = false;
let mockSaveDraftPending = false;
let mockSubmitResult: Task;

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  const React = await import("react");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ taskId: mockTaskId }),
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) =>
      React.createElement("div", {
        "data-testid": "route-redirect",
        "data-to": to,
        "data-replace": String(Boolean(replace)),
      }),
  };
});

vi.mock("~/lib/api/queries", () => ({
  useTask: () => ({ isLoading: mockTaskLoading, data: mockTask }),
  useStartTask: () => ({ mutateAsync: mockStart }),
  useAnswerQuestion: () => ({ mutateAsync: mockAnswer }),
  useSubmitTask: (options?: {
    onSuccess?: (data: Task, variables: { taskId: string; body: unknown }) => void;
  }) => ({
    isPending: mockSubmitPending,
    mutateAsync: async (variables: { taskId: string; body: unknown }) => {
      const result = (await mockSubmit(variables)) ?? mockSubmitResult;
      options?.onSuccess?.(result, variables);
      return result;
    },
  }),
  useSaveDraft: () => ({
    isPending: mockSaveDraftPending,
    mutateAsync: mockSaveDraft,
  }),
}));

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  user_id: "user-1",
  course_id: "reading",
  course_type: "unseen_text",
  interest_id: "space",
  grade_level_at_roll: 4,
  status: "in_progress",
  title: "Moon Signals",
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
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  ...overrides,
});

const readingTask = (overrides: Partial<Task> = {}): Task =>
  baseTask({
    course_id: "reading",
    course_type: "unseen_text",
    title: "Moon Signals",
    reading: {
      title: "The Signal on the Moon",
      passage_text: "A rover heard a signal. The signal came from a hidden crater.",
      passage_paragraphs: [
        "A rover heard a signal near the quiet ridge.",
        "The signal came from a hidden crater full of blue dust.",
      ],
      passage_word_count: 23,
      questions: [
        {
          id: "q-mc",
          position: 1,
          question_type: "multiple_choice",
          prompt: "Where did the rover hear the signal?",
          options: ["Inside a cave", "Near the quiet ridge", "At the launch pad"],
          max_points: 1,
        },
        {
          id: "q-tf",
          position: 2,
          question_type: "true_false",
          prompt: "The crater was full of blue dust.",
          options: ["True", "False"],
          max_points: 1,
        },
        {
          id: "q-fill",
          position: 3,
          question_type: "fill_blank",
          prompt: "The signal came from a hidden ____.",
          options: null,
          max_points: 1,
        },
      ],
    },
    ...overrides,
  });

const writingTask = (overrides: Partial<Task> = {}): Task =>
  baseTask({
    id: "task-writing",
    course_id: "writing",
    course_type: "short_writing",
    interest_id: "travel",
    title: "Dream Trip",
    topic_label: "Travel",
    writing: {
      title: "A place I want to visit",
      prompt: "Write about a place you would like to visit and explain why.",
      hints: ["Name the place.", "Use sensory details.", "Explain your reason."],
      min_words: 5,
      max_words: 8,
      draft: "",
    },
    ...overrides,
  });

describe("TaskRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockStart.mockReset();
    mockAnswer.mockReset();
    mockSubmit.mockReset();
    mockSaveDraft.mockReset();
    mockTaskId = "task-1";
    mockTaskLoading = false;
    mockSubmitPending = false;
    mockSaveDraftPending = false;
    mockTask = readingTask();
    mockSubmitResult = baseTask({ status: "completed" });
    mockStart.mockResolvedValue(readingTask({ status: "in_progress" }));
    mockSubmit.mockResolvedValue(mockSubmitResult);
    mockSaveDraft.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-starts a task that has not been started yet", async () => {
    mockTask = readingTask({ status: "not_started" });

    render(<TaskRoute />);

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith("task-1");
    });
  });

  it.each(["completed", "failed", "needs_retry"] as const)(
    "redirects %s tasks to the result screen",
    (status) => {
      mockTask = readingTask({ status });

      render(<TaskRoute />);

      const redirect = screen.getByTestId("route-redirect");
      expect(redirect).toHaveAttribute("data-to", "/tasks/task-1/result");
      expect(redirect).toHaveAttribute("data-replace", "true");
    }
  );

  it("moves from the reading passage through all question types and submits answers", async () => {
    mockTask = readingTask();

    render(<TaskRoute />);

    expect(screen.getByText("The Signal on the Moon")).toBeInTheDocument();
    expect(screen.getByText(/A rover heard a signal/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start questions/i }));

    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /near the quiet ridge/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(mockAnswer).toHaveBeenLastCalledWith({
      question_id: "q-mc",
      answer: 1,
    });

    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /true/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(mockAnswer).toHaveBeenLastCalledWith({
      question_id: "q-tf",
      answer: 0,
    });

    expect(screen.getByText("Question 3 of 3")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/type your answer/i), {
      target: { value: "crater" },
    });
    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => {
      expect(mockAnswer).toHaveBeenLastCalledWith({
        question_id: "q-fill",
        answer: "crater",
      });
      expect(mockSubmit).toHaveBeenCalledWith({
        taskId: "task-1",
        body: {
          answers: [
            { question_id: "q-mc", answer: 1 },
            { question_id: "q-tf", answer: 0 },
            { question_id: "q-fill", answer: "crater" },
          ],
        },
      });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-1/result");
    });
  });

  it("gates writing submission by the configured word count", () => {
    mockTaskId = "task-writing";
    mockTask = writingTask();

    render(<TaskRoute />);

    const textarea = screen.getByPlaceholderText(/start writing here/i);
    const submit = screen.getByRole("button", { name: /^submit$/i });

    expect(submit).toBeDisabled();

    fireEvent.change(textarea, {
      target: { value: "one two three four five" },
    });
    expect(submit).toBeEnabled();

    fireEvent.change(textarea, {
      target: { value: "one two three four five six seven eight nine" },
    });
    expect(submit).toBeDisabled();
  });

  it("fills the writing editor with the sample answer", () => {
    mockTaskId = "task-writing";
    mockTask = writingTask({
      writing: {
        title: "A place I want to visit",
        prompt: "Write about a place you would like to visit and explain why.",
        hints: ["Name the place.", "Use sensory details.", "Explain your reason."],
        min_words: 60,
        max_words: 120,
        draft: "",
      },
    });

    render(<TaskRoute />);

    const textarea = screen.getByPlaceholderText(/start writing here/i) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole("button", { name: /use sample answer/i }));

    expect(textarea.value).toContain("Kyoto");
    expect(textarea.value.split(/\s+/).length).toBeGreaterThanOrEqual(60);
    expect(screen.getByRole("button", { name: /^submit$/i })).toBeEnabled();
  });

  it("saves writing drafts manually and automatically", async () => {
    vi.useFakeTimers();
    mockTaskId = "task-writing";
    mockTask = writingTask();

    render(<TaskRoute />);

    const textarea = screen.getByPlaceholderText(/start writing here/i);
    fireEvent.change(textarea, {
      target: { value: "one two three four five" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));
    expect(mockSaveDraft).toHaveBeenCalledWith("one two three four five");

    fireEvent.change(textarea, {
      target: { value: "six seven eight nine ten" },
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockSaveDraft).toHaveBeenLastCalledWith("six seven eight nine ten");
  });

  it("submits writing through the confirmation modal with the full text payload", async () => {
    mockTaskId = "task-writing";
    mockTask = writingTask();
    mockSubmitResult = writingTask({ status: "processing" });
    mockSubmit.mockResolvedValue(mockSubmitResult);

    render(<TaskRoute />);

    const textarea = screen.getByPlaceholderText(/start writing here/i);
    fireEvent.change(textarea, {
      target: { value: "one two three four five" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    const firstDialog = screen.getByRole("dialog", { name: /confirm submit/i });
    expect(firstDialog).toHaveTextContent(/send it to hafuyfay/i);
    fireEvent.click(within(firstDialog).getByRole("button", { name: /keep editing/i }));

    expect(screen.queryByRole("dialog", { name: /confirm submit/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    const dialog = screen.getByRole("dialog", { name: /confirm submit/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /submit answer/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        taskId: "task-writing",
        body: { full_text: "one two three four five" },
      });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-writing");
    });
  });

  it("shows the writing processing state and lets the user return to the dashboard", () => {
    mockTaskId = "task-writing";
    mockTask = writingTask({ status: "processing" });

    render(<TaskRoute />);

    expect(
      screen.getByRole("heading", { name: /hafuyfay is reading your answer/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/checking your work/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go to dashboard/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
