import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import LoginRoute from "../login";

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

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ signin: mockSignin, signinGoogle: mockSigninGoogle }),
}));

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

beforeEach(() => {
  vi.resetAllMocks();
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
    mockSignin.mockResolvedValue({ email: "maya@example.com" });
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(mockSignin).toHaveBeenCalledWith("maya@example.com", "demo1234")
    );
  });

  it("navigates to /dashboard after successful login", async () => {
    mockSignin.mockResolvedValue({ email: "maya@example.com" });
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
  });

  it("navigates to the returnTo query param after login", async () => {
    mockSignin.mockResolvedValue({ email: "maya@example.com" });
    renderLogin("?returnTo=/courses");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/courses"));
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
    await user.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() =>
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument()
    );
  });
});

describe("Google sign-in", () => {
  it("calls signinGoogle and navigates to dashboard", async () => {
    mockSigninGoogle.mockResolvedValue({ email: "maya@example.com" });
    renderLogin();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /continue with google/i }));
    await waitFor(() => expect(mockSigninGoogle).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard"));
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
