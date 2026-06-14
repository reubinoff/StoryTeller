import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardRoute from "../dashboard";
import type { DashboardResponse, User } from "~/lib/api/types";

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

const dashboardData: DashboardResponse = {
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
  recommended: [],
  achievements_recent: [],
};

vi.mock("~/lib/api/queries", () => ({
  useDashboard: () => ({ isLoading: false, data: dashboardData }),
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

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe("DashboardRoute", () => {
  it("shows a visible progress state while a reading task is rolling", () => {
    mockRollTask = {
      isPending: true,
      variables: { courseId: "reading" },
      mutateAsync: vi.fn(),
    };

    render(<DashboardRoute />);

    expect(
      screen.getByRole("button", { name: /generating reading/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("status", { name: /generating your reading task/i })
    ).toHaveTextContent("Building a fresh passage and questions");
    expect(
      screen.getByRole("progressbar", { name: /task generation in progress/i })
    ).toBeInTheDocument();
  });
});
