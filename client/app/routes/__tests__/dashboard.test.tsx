import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardRoute from "../dashboard";
import type { DashboardResponse, RecentTask, User } from "~/lib/api/types";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockPush = vi.fn();

vi.mock("~/components/Toast", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/components/Toast")>();
  return { ...actual, useToast: () => ({ push: mockPush }) };
});

let mockRollTask: {
  isPending: boolean;
  variables?: { courseId: "reading" | "writing" };
  mutateAsync: ReturnType<typeof vi.fn>;
};

const baseDashboardData: DashboardResponse = {
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
  recent: [],
  ready_tasks: {
    reading: null,
    writing: null,
  },
  recommended: [],
  achievements_recent: [],
};

let mockDashboard: {
  isLoading: boolean;
  data?: DashboardResponse;
};

vi.mock("~/lib/api/queries", () => ({
  useDashboard: () => mockDashboard,
  useRollTask: () => mockRollTask,
}));

const mockUser: User = {
  id: "user-1",
  email: "maya@example.com",
  email_verified: true,
  first_name: "Maya",
  last_name: "Patel",
  year_of_birth: 2017,
  grade_level: 4,
  english_level: 24,
  phone_number: null,
  avatar_url: null,
  display_locale: "en",
  theme_preference: "auto",
  text_size_preference: "md",
  reduce_motion: false,
  notif_email_enabled: true,
  notif_inapp_enabled: true,
  interests: ["animals"],
  role: "user",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
  onboarding_completed: true,
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

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe("DashboardRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockPush.mockReset();
    mockDashboard = {
      isLoading: false,
      data: {
        ...baseDashboardData,
        metrics: { ...baseDashboardData.metrics },
        in_progress: [],
        recent: [],
        ready_tasks: { reading: null, writing: null },
        recommended: [],
        achievements_recent: [],
      },
    };
    mockRollTask = {
      isPending: false,
      mutateAsync: vi.fn(),
    };
  });

  it("shows the loading state while dashboard data is unavailable", () => {
    mockDashboard = { isLoading: true };

    const { container } = render(<DashboardRoute />);

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/ready for today's story practice/i),
    ).not.toBeInTheDocument();
  });

  it("shows loaded metrics and empty dashboard sections", () => {
    render(<DashboardRoute />);

    expect(
      screen.getByRole("heading", {
        name: /choose today's story mission/i,
      }),
    ).toBeInTheDocument();
    expect(metricCard("Tasks completed")).toHaveTextContent("4");
    expect(metricCard("Current streak")).toHaveTextContent("7 days");
    expect(metricCard("Average score")).toHaveTextContent("86%");
    expect(metricCard("Total XP")).toHaveTextContent("1,240");
    expect(screen.getByRole("button", { name: /reading mission/i })).toHaveClass(
      "btn-teal",
    );
    expect(screen.getByRole("button", { name: /writing mission/i })).toHaveClass(
      "btn-accent",
    );
    expect(screen.getByText(/rest days help stories settle/i)).toBeInTheDocument();
    expect(screen.getByText("No tasks in progress.")).toBeInTheDocument();
    expect(screen.getByText("0 of 0").parentElement).toHaveTextContent(
      "badges earned",
    );
  });

  it("rolls tasks from the dashboard and routes to the returned task", async () => {
    mockRollTask.mutateAsync.mockResolvedValue({
      id: "task-new",
      status: "not_started",
    });

    render(<DashboardRoute />);

    fireEvent.click(
      screen.getByRole("button", { name: /reading mission/i }),
    );

    await waitFor(() => {
      expect(mockRollTask.mutateAsync).toHaveBeenCalledWith({
        courseId: "reading",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-new");
    });
  });

  it("opens a ready writing task without rolling from the dashboard", () => {
    mockDashboard.data = {
      ...(mockDashboard.data as DashboardResponse),
      ready_tasks: {
        reading: null,
        writing: {
          id: "task-ready-writing",
          course_id: "writing",
          course_type: "short_writing",
          status: "not_started",
          title: "A ready prompt",
          topic_label: "Travel",
        },
      },
    };

    render(<DashboardRoute />);

    fireEvent.click(screen.getByRole("button", { name: /start writing/i }));

    expect(mockRollTask.mutateAsync).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/task-ready-writing");
  });

  it("surfaces roll failures from the dashboard", async () => {
    mockRollTask.mutateAsync.mockRejectedValue(new Error("roll failed"));

    render(<DashboardRoute />);

    fireEvent.click(
      screen.getByRole("button", { name: /writing mission/i }),
    );

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        icon: "⚠️",
        title: "Couldn't roll a task. Try again.",
      }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("routes recent tasks to active tasks or result pages", () => {
    mockDashboard.data = {
      ...(mockDashboard.data as DashboardResponse),
      recent: [
        recentTask({
          id: "active-task",
          topic: "Moon mystery",
          status: "in_progress",
        }),
        recentTask({
          id: "completed-task",
          topic: "Garden story",
          status: "completed",
          score: 92,
        }),
      ],
    };

    render(<DashboardRoute />);

    const activeRow = screen.getByText("Moon mystery").closest("tr");
    const completedRow = screen.getByText("Garden story").closest("tr");

    expect(activeRow).not.toBeNull();
    expect(completedRow).not.toBeNull();

    fireEvent.click(activeRow as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/active-task");

    fireEvent.keyDown(completedRow as HTMLElement, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/completed-task/result");
  });

  it("shows a visible progress state while a reading task is rolling", () => {
    mockRollTask = {
      isPending: true,
      variables: { courseId: "reading" },
      mutateAsync: vi.fn(),
    };

    render(<DashboardRoute />);

    expect(
      screen.getByRole("button", { name: /making reading/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("status", { name: /generating your reading task/i }),
    ).toHaveTextContent("Building a fresh passage and questions");
    expect(
      screen.getByRole("progressbar", { name: /task generation in progress/i }),
    ).toBeInTheDocument();
  });

  it("prioritizes an in-progress task as today's mission", () => {
    mockDashboard.data = {
      ...(mockDashboard.data as DashboardResponse),
      in_progress: [
        recentTask({
          id: "mission-task",
          topic: "Moon mystery",
          status: "in_progress",
        }),
      ],
    };

    render(<DashboardRoute />);

    expect(
      screen.getByRole("heading", { name: /today's story mission: moon mystery/i }),
    ).toBeInTheDocument();
    const mission = screen
      .getByRole("heading", { name: /today's story mission: moon mystery/i })
      .closest(".daily-mission-card");
    expect(mission).not.toBeNull();
    fireEvent.click(within(mission as HTMLElement).getByRole("button", { name: /resume/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/tasks/mission-task");
  });
});

function metricCard(label: string): HTMLElement {
  const card = screen.getByText(label).closest(".card");
  if (!card) throw new Error(`No metric card found for ${label}`);
  return card as HTMLElement;
}
