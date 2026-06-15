import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import LoginRoute from "../login";
import type { User } from "~/lib/api/types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignin = vi.fn();
const mockSigninGoogle = vi.fn();
let mockAuthState: {
  user: User | null;
  ready: boolean;
  signin: ReturnType<typeof vi.fn>;
  signinGoogle: ReturnType<typeof vi.fn>;
};

vi.mock("~/lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

const completedUser: User = {
  id: "user-1",
  email: "maya@example.com",
  email_verified: true,
  first_name: "Maya",
  last_name: "Patel",
  year_of_birth: 2014,
  grade_level: 7,
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLogin(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <LoginRoute />
    </MemoryRouter>
  );
}

async function typeCredentials(
  user: ReturnType<typeof userEvent.setup>,
  email = "maya@example.com",
  password = "demo1234"
) {
  await user.clear(screen.getByLabelText("Email"));
  await user.type(screen.getByLabelText("Email"), email);
  await user.clear(screen.getByLabelText("Password"));
  await user.type(screen.getByLabelText("Password"), password);
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = {
    user: null,
    ready: true,
    signin: mockSignin,
    signinGoogle: mockSigninGoogle,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LoginRoute rendering", () => {
  it("renders the email and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the login submit button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders the Google sign-in button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("renders a link to sign up", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: /create an account/i })).toBeInTheDocument();
  });
});

describe("LoginRoute form validation", () => {
  it("shows a validation error for an invalid email", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(screen.getByText("Please enter a valid email")).toBeInTheDocument()
    );
  });

  it("shows a validation error for an empty password", async () => {
    renderLogin();
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "valid@email.com");
    await user.clear(screen.getByLabelText("Password"));
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("Required")).toBeInTheDocument());
  });
});

describe("LoginRoute submission", () => {
  it("calls signin with form values on submit", async () => {
    mockSignin.mockResolvedValue({ email: "maya@example.com", onboarding_completed: true });
    renderLogin();
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(mockSignin).toHaveBeenCalledWith("maya@example.com", "demo1234")
    );
  });

  it("navigates to /dashboard after successful login", async () => {
    mockSignin.mockResolvedValue({ email: "maya@example.com", onboarding_completed: true });
    renderLogin();
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("navigates to the returnTo query param after login", async () => {
    mockSignin.mockResolvedValue({ email: "maya@example.com", onboarding_completed: true });
    renderLogin("?returnTo=/courses");
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/courses"));
  });

  it("falls back to /dashboard when returnTo is unsafe after login", async () => {
    mockSignin.mockResolvedValue(completedUser);
    renderLogin("?returnTo=//evil.example/path");
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays the API error detail on failed login", async () => {
    const { ApiError } = await import("~/lib/api/client");
    mockSignin.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Invalid credentials",
        status: 401,
        code: "invalid_credentials",
        detail: "Email or password is incorrect",
      })
    );
    renderLogin();
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(screen.getByText("Email or password is incorrect")).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a generic error for non-ApiError failures", async () => {
    mockSignin.mockRejectedValue(new Error("Network error"));
    renderLogin();
    const user = userEvent.setup();
    await typeCredentials(user);
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument()
    );
  });
});

describe("Google sign-in", () => {
  it("calls signinGoogle with the dashboard destination", async () => {
    mockSigninGoogle.mockResolvedValue({
      email: "maya@example.com",
      onboarding_completed: true,
    });
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() =>
      expect(mockSigninGoogle).toHaveBeenCalledWith("/dashboard", "login")
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("passes only safe returnTo values to Google sign-in", async () => {
    mockSigninGoogle.mockResolvedValue(completedUser);
    renderLogin("?returnTo=https://evil.example/path");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() =>
      expect(mockSigninGoogle).toHaveBeenCalledWith("/dashboard", "login")
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows an error when Google sign-in fails", async () => {
    mockSigninGoogle.mockRejectedValue(new Error("OAuth error"));
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() =>
      expect(screen.getByText("Couldn't sign in with Google")).toBeInTheDocument()
    );
  });
});

describe("LoginRoute auth redirect", () => {
  it("redirects authenticated users away from login", async () => {
    mockAuthState.user = completedUser;
    renderLogin("?returnTo=/courses");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/courses", { replace: true })
    );
  });

  it("ignores unsafe returnTo values for authenticated users", async () => {
    mockAuthState.user = completedUser;
    renderLogin("?returnTo=/login");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true })
    );
  });

  it("does not redirect authenticated users before auth is ready", () => {
    mockAuthState = {
      ...mockAuthState,
      user: completedUser,
      ready: false,
    };
    renderLogin("?returnTo=/courses");

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
