import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaskResultRoute from "../task-result";
import type { ReadingResult, Task, WritingResult } from "~/lib/api/types";

const mockNavigate = vi.fn();
const mockRoll = vi.fn();
const mockRedo = vi.fn();
const mockRetry = vi.fn();

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
let mockResult: ReadingResult | WritingResult;

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
  useRetryTask: () => ({
    isPending: false,
    mutateAsync: mockRetry,
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
  next_task: {
    id: "task-next",
    course_id: "reading",
    course_type: "unseen_text",
    status: "not_started",
    title: "Next moon story",
    topic_label: "Space",
  },
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

const writingResult = (overrides: Partial<WritingResult> = {}): WritingResult => ({
  task_id: "task-1",
  mode: "writing",
  status: "completed",
  answer_text: "I walked through the market and wrote about every smell.",
  evaluation: {
    score_overall: 84,
    score_grammar: 80,
    score_vocabulary: 82,
    score_structure: 88,
    score_relevance: 86,
    feedback_summary: "Your paragraph stays focused and includes clear details.",
    feedback_detail: [
      "The response has a clear setting and enough supporting details.",
      "Try making the verbs more vivid next time.",
    ],
    focus_next: ["sensory details", "stronger verbs"],
    highlights: [
      {
        start: 2,
        end: 8,
        kind: "word_choice",
        message: "Use a stronger verb.",
      },
    ],
  },
  fail_reason: null,
  xp_earned: 62,
  passed: true,
  passing_score: 70,
  next_task: {
    id: "task-writing-next",
    course_id: "writing",
    course_type: "short_writing",
    status: "not_started",
    title: "Next market prompt",
    topic_label: "Travel",
  },
  submitted_at: "2026-06-01T10:05:00Z",
  completed_at: "2026-06-01T10:06:00Z",
  ...overrides,
});

const resultCardFor = (prompt: string) => {
  const card = screen.getByText(prompt).closest(".card");
  if (!card) throw new Error(`No result card found for ${prompt}`);
  return within(card as HTMLElement);
};

describe("TaskResultRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRoll.mockReset();
    mockRedo.mockReset();
    mockRetry.mockReset();
    mockTask = baseTask;
    mockResult = readingResult();
  });

  it("opens the prepared next task after a passing reading result", () => {
    render(<TaskResultRoute />);

    expect(screen.getByText(/your next task is ready/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));

    expect(mockRoll).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-next");
  });

  it("falls back to rolling the next reading task when no prepared task is returned", async () => {
    mockResult = readingResult({ next_task: null });
    mockRoll.mockResolvedValue({ id: "task-next-fallback", status: "not_started" });

    render(<TaskResultRoute />);

    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));

    await waitFor(() => {
      expect(mockRoll).toHaveBeenCalledWith({ courseId: "reading" });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-next-fallback");
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

  it("shows reading result answers and correct-answer explanations", () => {
    mockResult = readingResult({
      score: 1,
      total: 3,
      percentage: 33,
      passed: false,
      xp_earned: 12,
      questions: [
        {
          id: "q-mc",
          position: 1,
          question_type: "multiple_choice",
          prompt: "Which planet was behind the ridge?",
          options: ["Moon", "Mars", "Venus"],
          correct_answer: "1",
          explanation: "The passage names Mars as the planet behind the ridge.",
          max_points: 1,
          user_answer: 0,
          is_correct: false,
        },
        {
          id: "q-tf",
          position: 2,
          question_type: "true_false",
          prompt: "The rover found a signal.",
          options: ["True", "False"],
          correct_answer: "0",
          explanation: "The rover heard the signal near the ridge.",
          max_points: 1,
          user_answer: 0,
          is_correct: true,
        },
        {
          id: "q-fill",
          position: 3,
          question_type: "fill_blank",
          prompt: "The sky was full of ____.",
          options: null,
          correct_answer: "stars",
          explanation: "The passage says the sky was full of stars.",
          max_points: 1,
          user_answer: "clouds",
          is_correct: false,
        },
      ],
    });

    render(<TaskResultRoute />);

    const multipleChoice = resultCardFor("Which planet was behind the ridge?");
    expect(multipleChoice.getByText("Moon")).toBeInTheDocument();
    expect(multipleChoice.getByText("Mars")).toBeInTheDocument();
    expect(multipleChoice.getByText(/The passage names Mars/i)).toBeInTheDocument();

    const trueFalse = resultCardFor("The rover found a signal.");
    expect(trueFalse.getByText("Correct")).toBeInTheDocument();
    expect(trueFalse.getAllByText("True")).toHaveLength(2);

    const fillBlank = resultCardFor("The sky was full of ____.");
    expect(fillBlank.getByText("clouds")).toBeInTheDocument();
    expect(fillBlank.getByText("stars")).toBeInTheDocument();
    expect(fillBlank.getByText(/sky was full of stars/i)).toBeInTheDocument();
  });

  it("shows the pending writing result branch while feedback is processing", () => {
    mockResult = writingResult({
      status: "processing",
      evaluation: null,
      passed: null,
      completed_at: null,
    });

    render(<TaskResultRoute />);

    expect(screen.getByText(/still cooking/i)).toBeInTheDocument();
    expect(
      screen.getByText(/we'll notify you when the feedback is ready/i)
    ).toBeInTheDocument();
  });

  it("shows completed writing feedback with highlights and next-task action", () => {
    mockResult = writingResult();

    render(<TaskResultRoute />);

    expect(screen.getByText(/nicely done, Maya/i)).toBeInTheDocument();
    expect(screen.getByText("84")).toBeInTheDocument();
    expect(screen.getByText(/clear details/i)).toBeInTheDocument();
    const annotated = screen.getByRole("button", {
      name: /word choice note: use a stronger verb/i,
    });
    expect(annotated).toHaveTextContent("walked");
    expect(screen.getByText(/select an underlined phrase/i)).toBeInTheDocument();
    const notes = screen.getByLabelText("Writing notes");
    expect(within(notes).getByRole("button", { name: /walked/i })).toHaveTextContent(
      "Use a stronger verb."
    );
    fireEvent.click(annotated);
    expect(annotated).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("sensory details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));

    expect(mockRoll).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-writing-next");
  });

  it("falls back to rolling the next writing task when no prepared task is returned", async () => {
    mockResult = writingResult({ next_task: null });
    mockRoll.mockResolvedValue({
      id: "task-writing-next-fallback",
      status: "not_started",
    });

    render(<TaskResultRoute />);

    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));

    await waitFor(() => {
      expect(mockRoll).toHaveBeenCalledWith({ courseId: "writing" });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-writing-next-fallback");
    });
  });

  it("shows failed writing feedback with retry action instead of processing copy", async () => {
    mockResult = writingResult({
      status: "failed",
      evaluation: null,
      fail_reason: "Evaluation queue unavailable",
      passed: null,
      completed_at: null,
    });
    mockRetry.mockResolvedValue({
      id: "task-1",
      status: "processing",
      submitted_at: "2026-06-01T10:05:00Z",
    });

    render(<TaskResultRoute />);

    expect(screen.getByText(/couldn't finish the feedback/i)).toBeInTheDocument();
    expect(screen.getByText(/evaluation queue unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/still cooking/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry feedback/i }));

    await waitFor(() => {
      expect(mockRetry).toHaveBeenCalledWith("task-1");
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-1");
    });
  });

  it("redos a low-scoring writing result and returns to the draft", async () => {
    mockResult = writingResult({
      status: "needs_retry",
      passed: false,
      evaluation: {
        ...writingResult().evaluation!,
        score_overall: 62,
        feedback_summary: "You have a clear topic, but need more structure.",
      },
    });
    mockRedo.mockResolvedValue({ id: "task-1", status: "in_progress" });

    render(<TaskResultRoute />);

    expect(screen.getByText(/you need 70% to move on/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockRedo).toHaveBeenCalledWith("task-1");
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-1");
    });
  });
});
