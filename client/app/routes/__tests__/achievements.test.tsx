import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AchievementsRoute from "../achievements";
import type { Achievement } from "~/lib/api/types";

let mockAchievementsQuery: {
  isLoading: boolean;
  data?: Achievement[];
};

vi.mock("~/lib/api/queries", () => ({
  useAchievements: () => mockAchievementsQuery,
}));

const achievement = (overrides: Partial<Achievement>): Achievement => ({
  id: "achievement-1",
  slug: "first-task",
  name: "First Task",
  description: "Complete your first task.",
  icon: "A",
  earned: true,
  earned_at: "2026-06-01T10:00:00Z",
  ...overrides,
});

describe("AchievementsRoute", () => {
  beforeEach(() => {
    mockAchievementsQuery = {
      isLoading: false,
      data: [],
    };
  });

  it("shows loading placeholders while achievements are loading", () => {
    mockAchievementsQuery = {
      isLoading: true,
    };

    const { container } = render(<AchievementsRoute />);

    expect(
      screen.getByRole("heading", { name: "Achievements" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton")).toHaveLength(6);
  });

  it("renders earned and locked achievement states", () => {
    mockAchievementsQuery.data = [
      achievement({
        id: "earned",
        name: "First Spark",
        description: "Complete one task.",
        earned: true,
        earned_at: "2026-06-01T10:00:00Z",
      }),
      achievement({
        id: "locked",
        name: "Streak Starter",
        description: "Practice three days in a row.",
        icon: "L",
        earned: false,
        earned_at: null,
      }),
    ];

    render(<AchievementsRoute />);

    const earnedCard = screen.getByText("First Spark").closest(".card");
    const lockedCard = screen.getByText("Streak Starter").closest(".card");

    expect(earnedCard).not.toBeNull();
    expect(lockedCard).not.toBeNull();
    expect(
      within(earnedCard as HTMLElement).getByText("Earned"),
    ).toBeInTheDocument();
    expect(
      within(lockedCard as HTMLElement).getByText("Locked"),
    ).toBeInTheDocument();
    expect(earnedCard).toHaveStyle({ opacity: "1" });
    expect(lockedCard).toHaveStyle({ opacity: "0.5" });
  });

  it("keeps the page shell visible when the achievement list is empty", () => {
    render(<AchievementsRoute />);

    expect(
      screen.getByRole("heading", { name: "Achievements" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Earned")).not.toBeInTheDocument();
    expect(screen.queryByText("Locked")).not.toBeInTheDocument();
  });
});
