import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import OnboardingRoute from "../onboarding";
import type { User } from "~/lib/api/types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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

const mockSetInterests = vi.fn();
const mockSetUser = vi.fn();
let mockAuthState: {
  user: User | null;
  ready: boolean;
  setInterests: ReturnType<typeof vi.fn>;
  setUser: ReturnType<typeof vi.fn>;
};

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser: User = {
  id: "user-1",
  email: "test@test.com",
  email_verified: true,
  first_name: "Alex",
  last_name: "Smith",
  year_of_birth: 2010,
  grade_level: 6,
  phone_number: null,
  avatar_url: null,
  display_locale: "en",
  theme_preference: "auto",
  text_size_preference: "md",
  reduce_motion: false,
  notif_email_enabled: true,
  notif_inapp_enabled: true,
  interests: [],
  role: "user",
  status: "active",
  created_at: "2024-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <OnboardingRoute />
    </MemoryRouter>
  );
}

async function navigateToStep(user: ReturnType<typeof userEvent.setup>, step: 2 | 3) {
  await user.click(screen.getByRole("button", { name: /let's go/i }));
  if (step === 3) {
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByText("What do you love?")).toBeInTheDocument());
  } else {
    await waitFor(() => expect(screen.getByText("Pick your starting level")).toBeInTheDocument());
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  mockSetInterests.mockResolvedValue(undefined);
  mockAuthState = {
    user: mockUser,
    ready: true,
    setInterests: mockSetInterests,
    setUser: mockSetUser,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OnboardingRoute — auth guard", () => {
  it("redirects to /login when user is null", async () => {
    mockAuthState = { user: null, ready: true, setInterests: mockSetInterests, setUser: mockSetUser };
    renderOnboarding();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/login"));
  });

  it("renders nothing while not ready without a user", () => {
    mockAuthState = { user: null, ready: false, setInterests: mockSetInterests, setUser: mockSetUser };
    const { container } = renderOnboarding();
    expect(container.firstChild).toBeNull();
  });
});

describe("OnboardingRoute — step 1 (welcome)", () => {
  it("greets the user by first name", () => {
    renderOnboarding();
    expect(screen.getByText(/Hi Alex/i)).toBeInTheDocument();
  });

  it("shows the step counter", () => {
    renderOnboarding();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("renders the Let's go button", () => {
    renderOnboarding();
    expect(screen.getByRole("button", { name: /let's go/i })).toBeInTheDocument();
  });
});

describe("OnboardingRoute — step 2 (grade)", () => {
  it("advances to step 2 when clicking Let's go", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 2);
    expect(screen.getByText("Pick your starting level")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("shows 12 grade buttons", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 2);
    // Grades 1–12 are rendered as buttons
    for (let g = 1; g <= 12; g++) {
      expect(screen.getByRole("button", { name: String(g) })).toBeInTheDocument();
    }
  });

  it("navigates back to step 1 via Back button", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 2);
    await user.click(screen.getByRole("button", { name: /back/i }));
    await waitFor(() => expect(screen.getByText(/Hi Alex/i)).toBeInTheDocument());
  });
});

describe("OnboardingRoute — step 3 (topics)", () => {
  it("advances to step 3 when clicking Continue", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    expect(screen.getByText("What do you love?")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });

  it("renders all 15 topics", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    expect(screen.getByText("Animals & Pets")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("Space & Astronomy")).toBeInTheDocument();
    expect(screen.getByText("Video Games")).toBeInTheDocument();
    expect(screen.getByText("Health & Wellness")).toBeInTheDocument();
  });

  it("shows 0 of 6 selected initially", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    expect(screen.getByText("0 of 6 selected")).toBeInTheDocument();
  });

  it("disables the finish button when no topic is selected", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    expect(screen.getByRole("button", { name: /roll my first task/i })).toBeDisabled();
  });

  it("enables the finish button after selecting at least one topic", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    expect(screen.getByRole("button", { name: /roll my first task/i })).not.toBeDisabled();
  });

  it("updates the count when a topic is selected", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    expect(screen.getByText("1 of 6 selected")).toBeInTheDocument();
  });

  it("deselects a topic when clicked again", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    await user.click(screen.getByText("Animals & Pets"));
    expect(screen.getByText("0 of 6 selected")).toBeInTheDocument();
  });

  it("caps selection at 6 topics", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);

    const six = ["Animals & Pets", "Sports", "Music", "Movies & TV", "Science & Nature", "Space & Astronomy"];
    for (const topic of six) {
      await user.click(screen.getByText(topic));
    }
    expect(screen.getByText("6 of 6 selected")).toBeInTheDocument();
  });

  it("disables the 7th topic button after 6 are selected", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);

    const six = ["Animals & Pets", "Sports", "Music", "Movies & TV", "Science & Nature", "Space & Astronomy"];
    for (const topic of six) {
      await user.click(screen.getByText(topic));
    }
    expect(screen.getByText("Tech & Gadgets").closest("button")).toBeDisabled();
  });

  it("navigates back to step 2 via Back button", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByRole("button", { name: /back/i }));
    await waitFor(() => expect(screen.getByText("Pick your starting level")).toBeInTheDocument());
  });
});

describe("OnboardingRoute — finishing onboarding", () => {
  it("calls setInterests with selected topic IDs", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    await user.click(screen.getByText("Sports"));
    await user.click(screen.getByRole("button", { name: /roll my first task/i }));
    await waitFor(() =>
      expect(mockSetInterests).toHaveBeenCalledWith(["animals", "sports"])
    );
  });

  it("calls setUser to persist grade and interests", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    await user.click(screen.getByRole("button", { name: /roll my first task/i }));
    await waitFor(() => expect(mockSetUser).toHaveBeenCalled());
    const updatedUser = mockSetUser.mock.calls[0][0] as User;
    expect(updatedUser.interests).toContain("animals");
  });

  it("shows a welcome toast after finishing", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    await user.click(screen.getByRole("button", { name: /roll my first task/i }));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("Alex") })
      )
    );
  });

  it("navigates to /dashboard after finishing", async () => {
    renderOnboarding();
    const user = userEvent.setup();
    await navigateToStep(user, 3);
    await user.click(screen.getByText("Animals & Pets"));
    await user.click(screen.getByRole("button", { name: /roll my first task/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });
});
