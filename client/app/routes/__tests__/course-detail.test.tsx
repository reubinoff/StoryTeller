import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CourseDetailRoute from "../course-detail";
import type {
  Course,
  CourseId,
  DashboardResponse,
  RecentTask,
} from "~/lib/api/types";

const mockNavigate = vi.fn();
const mockPush = vi.fn();
let mockCourseId: CourseId;

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ courseId: mockCourseId }),
  };
});

vi.mock("~/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/components/Toast")>();
  return { ...actual, useToast: () => ({ push: mockPush }) };
});

let mockCourseQuery: {
  isLoading: boolean;
  data?: Course;
};
let mockDashboardQuery: {
  isLoading: boolean;
  data?: DashboardResponse;
};
let mockRollTask: {
  isPending: boolean;
  variables?: { courseId: CourseId };
  mutateAsync: ReturnType<typeof vi.fn>;
};

vi.mock("~/lib/api/queries", () => ({
  useCourse: () => mockCourseQuery,
  useDashboard: () => mockDashboardQuery,
  useRollTask: () => mockRollTask,
}));

const readingCourse: Course = {
  id: "reading",
  slug: "reading",
  type: "unseen_text",
  title: "Story Reading",
  subtitle: "Unseen Text",
  description: "Read a short passage and answer questions.",
  min_grade: 1,
  max_grade: 12,
  estimated_minutes: 5,
  illustration: "reading",
};

const writingCourse: Course = {
  id: "writing",
  slug: "writing",
  type: "short_writing",
  title: "Writing Practice",
  subtitle: "Short-Answer Writing",
  description: "Write a short answer and receive feedback.",
  min_grade: 1,
  max_grade: 12,
  estimated_minutes: 10,
  illustration: "writing",
};

const recentTask = (overrides: Partial<RecentTask>): RecentTask => ({
  id: "task-1",
  course: "Story Reading",
  course_type: "unseen_text",
  topic: "Moon mystery",
  status: "in_progress",
  score: null,
  when: "Today",
  progress: null,
  passed: null,
  passing_score: 70,
  ...overrides,
});

const dashboardData = (recent: RecentTask[] = []): DashboardResponse => ({
  greeting: "Hi Maya",
  metrics: {
    tasks_completed: 4,
    current_streak: 7,
    longest_streak: 12,
    avg_score: 86,
    xp_total: 1240,
    level: 4,
    level_label: "Apprentice",
  },
  in_progress: [],
  recent,
  recommended: [],
  achievements_recent: [],
});

function renderRoute() {
  return render(
    <MemoryRouter>
      <CourseDetailRoute />
    </MemoryRouter>,
  );
}

describe("CourseDetailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPush.mockReset();
    mockCourseId = "reading";
    mockCourseQuery = { isLoading: false, data: readingCourse };
    mockDashboardQuery = { isLoading: false, data: dashboardData() };
    mockRollTask = {
      isPending: false,
      mutateAsync: vi.fn(),
    };
  });

  it("shows a loading fallback while the course is unavailable", () => {
    mockCourseQuery = { isLoading: true };

    const { container } = renderRoute();

    expect(container.querySelectorAll(".skeleton")).toHaveLength(2);
    expect(screen.queryByText("Roll a new task")).not.toBeInTheDocument();
  });

  it("shows an empty recent-task state for a course with no matching tasks", () => {
    mockDashboardQuery.data = dashboardData([
      recentTask({
        id: "writing-1",
        course: "Writing Practice",
        course_type: "short_writing",
        topic: "Future city",
      }),
    ]);

    renderRoute();

    expect(
      screen.getByText("No tasks yet. Roll your first one!"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Future city")).not.toBeInTheDocument();
  });

  it("shows course stats from matching recent tasks and opens their targets", () => {
    mockDashboardQuery.data = dashboardData([
      recentTask({
        id: "reading-active",
        topic: "Moon mystery",
        status: "in_progress",
        progress: {
          current: 3,
          total: 6,
          percentage: 50,
          label: "3 of 6 answered",
        },
      }),
      recentTask({
        id: "reading-done",
        topic: "Comet garden",
        status: "completed",
        score: 80,
        when: "Yesterday",
        passed: true,
      }),
      recentTask({
        id: "writing-1",
        course: "Writing Practice",
        course_type: "short_writing",
        topic: "Future city",
        status: "completed",
        score: 100,
      }),
    ]);

    renderRoute();

    expect(
      screen.getByRole("heading", { name: "Story Reading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tasks completed").parentElement).toHaveTextContent(
      "1",
    );
    expect(screen.getByText("Average score").parentElement).toHaveTextContent(
      "80%",
    );
    expect(screen.getByText("Time average").parentElement).toHaveTextContent(
      "5 min",
    );
    expect(screen.getByText("Moon mystery")).toBeInTheDocument();
    expect(screen.getByText("Comet garden")).toBeInTheDocument();
    expect(screen.queryByText("Future city")).not.toBeInTheDocument();

    const activeCard = screen.getByText("Moon mystery").closest(".card");
    const completedCard = screen.getByText("Comet garden").closest(".card");

    expect(activeCard).not.toBeNull();
    expect(completedCard).not.toBeNull();

    fireEvent.click(
      within(activeCard as HTMLElement).getByRole("button", {
        name: /resume/i,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/reading-active");

    fireEvent.click(
      within(completedCard as HTMLElement).getByRole("button", {
        name: /view result/i,
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/reading-done/result");
  });

  it("rolls a new task and navigates to it", async () => {
    mockRollTask.mutateAsync.mockResolvedValue({
      id: "task-new",
      status: "not_started",
    });

    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: /roll a new task/i }));

    await waitFor(() => {
      expect(mockRollTask.mutateAsync).toHaveBeenCalledWith({
        courseId: "reading",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-new");
    });
  });

  it("surfaces roll failures without navigating", async () => {
    mockRollTask.mutateAsync.mockRejectedValue(new Error("roll failed"));

    renderRoute();

    fireEvent.click(screen.getByRole("button", { name: /roll a new task/i }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        icon: "⚠️",
        title: "Couldn't roll a task. Try again.",
      }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows pending roll progress for the active course", () => {
    mockCourseId = "writing";
    mockCourseQuery.data = writingCourse;
    mockRollTask = {
      isPending: true,
      variables: { courseId: "writing" },
      mutateAsync: vi.fn(),
    };

    renderRoute();

    expect(
      screen.getByRole("button", { name: /generating task/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("status", { name: /generating your writing task/i }),
    ).toHaveTextContent("Choosing a fresh prompt for your level");
  });
});
