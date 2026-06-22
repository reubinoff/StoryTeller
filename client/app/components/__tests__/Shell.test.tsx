import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { Shell } from "../Shell";
import type { DashboardMetrics, Notification, Page, User } from "~/lib/api/types";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignout = vi.fn();
let mockAuthState: {
  user: User | null;
  signout: ReturnType<typeof vi.fn>;
};
let mockMetrics: DashboardMetrics;
let mockNotifications: Page<Notification>;
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

vi.mock("~/lib/api/queries", () => ({
  useMetrics: () => ({ data: mockMetrics }),
  useNotifications: () => ({ data: mockNotifications }),
  useMarkNotificationRead: () => ({
    mutate: mockMarkRead,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mockMarkAllRead,
    isPending: false,
  }),
}));

const user: User = {
  id: "user-1",
  email: "maya@example.com",
  email_verified: true,
  first_name: "Maya",
  last_name: "Patel",
  year_of_birth: 2014,
  grade_level: 7,
  english_level: 44,
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

function renderShell(entry = "/tasks") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Shell>
        <h1>Shell child content</h1>
      </Shell>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = {
    user,
    signout: mockSignout,
  };
  mockMetrics = {
    tasks_completed: 4,
    current_streak: 5,
    longest_streak: 7,
    avg_score: 82,
    xp_total: 1234,
    level: 2,
    level_label: "Builder",
  };
  mockNotifications = { items: [], next_cursor: null };
});

describe("Shell", () => {
  it("renders primary navigation, user metrics, and children", () => {
    renderShell("/tasks");

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getAllByRole("link", { name: /courses/i })[0]).toHaveAttribute(
      "href",
      "/courses"
    );
    expect(screen.getByRole("link", { name: /my tasks/i })).toHaveClass("active");
    expect(screen.getByRole("link", { name: /achievements/i })).toHaveAttribute(
      "href",
      "/achievements"
    );
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(screen.getByRole("link", { name: /help & faq/i })).toHaveAttribute(
      "href",
      "/help"
    );
    expect(screen.getByText("5 day streak")).toBeInTheDocument();
    expect(screen.getByText("1,234 XP")).toBeInTheDocument();
    expect(screen.getByText("Maya Patel")).toBeInTheDocument();
    expect(screen.getByText("Shell child content")).toBeInTheDocument();
    expect(screen.queryByText(/search courses/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute(
      "href",
      "/courses"
    );
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute(
      "href",
      "/settings"
    );
  });

  it("renders the uploaded profile avatar in the sidebar", () => {
    mockAuthState.user = {
      ...user,
      avatar_url: "/api/v1/me/avatar?version=1",
    };

    renderShell("/settings");

    expect(document.querySelector(".sidebar .avatar")).toHaveAttribute(
      "src",
      "/api/v1/me/avatar?version=1"
    );
    expect(screen.queryByText("M")).not.toBeInTheDocument();
  });

  it("signs out and returns to the public landing page", async () => {
    renderShell();
    const eventUser = userEvent.setup();

    await eventUser.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockSignout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("opens notifications and marks an unread item", async () => {
    mockNotifications = {
      items: [
        {
          id: "notif-1",
          kind: "task_completed",
          payload: { title: "Writing scored", detail: "Your story is ready." },
          read_at: null,
          created_at: "2024-01-02T00:00:00Z",
        },
      ],
      next_cursor: null,
    };
    renderShell();
    const eventUser = userEvent.setup();

    await eventUser.click(
      screen.getByRole("button", { name: /1 unread notifications/i })
    );
    await eventUser.click(screen.getByRole("button", { name: /writing scored/i }));

    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeInTheDocument();
    expect(mockMarkRead).toHaveBeenCalledWith("notif-1");
  });

  it("renders nothing when user state is absent", () => {
    mockAuthState.user = null;
    const { container } = renderShell();

    expect(container.firstChild).toBeNull();
  });
});
