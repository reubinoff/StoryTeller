import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import SignupRoute from "../signup";
import type { User } from "~/lib/api/types";

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

const mockSignup = vi.fn();
const mockSigninGoogle = vi.fn();
let mockAuthState: {
  user: User | null;
  ready: boolean;
  signup: ReturnType<typeof vi.fn>;
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

function renderSignup(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/signup${search}`]}>
      <SignupRoute />
    </MemoryRouter>
  );
}

async function fillSignupForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("First name"), "Maya");
  await user.type(screen.getByLabelText("Last name"), "Patel");
  await user.type(screen.getByLabelText("Email"), "maya@example.com");
  await user.type(screen.getByLabelText("Password"), "Story123");
  await user.type(screen.getByLabelText("Year of birth"), "2014");
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockAuthState = {
    user: null,
    ready: true,
    signup: mockSignup,
    signinGoogle: mockSigninGoogle,
  };
});

describe("SignupRoute rendering", () => {
  it("renders the account creation form and alternate auth actions", () => {
    renderSignup();

    expect(screen.getByLabelText("First name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Year of birth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login");
  });
});

describe("SignupRoute auth redirects", () => {
  it("redirects completed authenticated users away from signup", async () => {
    mockAuthState.user = completedUser;
    renderSignup("?returnTo=/courses");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/courses", { replace: true })
    );
  });

  it("ignores unsafe returnTo values for authenticated users", async () => {
    mockAuthState.user = completedUser;
    renderSignup("?returnTo=//evil.example/path");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true })
    );
  });

  it("routes authenticated users without onboarding to onboarding", async () => {
    mockAuthState.user = { ...completedUser, onboarding_completed: false };
    renderSignup("?returnTo=/courses");

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/onboarding", { replace: true })
    );
  });
});

describe("SignupRoute validation", () => {
  it("shows required-field validation errors", async () => {
    renderSignup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Please enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Min 8 characters")).toBeInTheDocument();
    expect(screen.getByText("Year of birth is required")).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it("requires a password with at least one number", async () => {
    renderSignup();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("First name"), "Maya");
    await user.type(screen.getByLabelText("Last name"), "Patel");
    await user.type(screen.getByLabelText("Email"), "maya@example.com");
    await user.type(screen.getByLabelText("Password"), "Storytime");
    await user.type(screen.getByLabelText("Year of birth"), "2014");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Include at least one number")).toBeInTheDocument();
    expect(mockSignup).not.toHaveBeenCalled();
  });
});

describe("SignupRoute submission", () => {
  it("submits normalized signup values and sends new users to onboarding", async () => {
    mockSignup.mockResolvedValue({ ...completedUser, onboarding_completed: false });
    renderSignup();
    const user = await fillSignupForm();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(mockSignup).toHaveBeenCalledWith({
        first_name: "Maya",
        last_name: "Patel",
        email: "maya@example.com",
        password: "Story123",
        year_of_birth: 2014,
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
  });

  it("shows an API error detail when account creation fails", async () => {
    const { ApiError } = await import("~/lib/api/client");
    mockSignup.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Email already registered",
        status: 409,
        code: "email_exists",
        detail: "That email is already in use",
      })
    );
    renderSignup();
    const user = await fillSignupForm();

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("That email is already in use")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe("SignupRoute Google sign-in", () => {
  it("passes a safe returnTo to Google sign-in and follows the post-auth destination", async () => {
    mockSigninGoogle.mockResolvedValue(completedUser);
    renderSignup("?returnTo=/courses");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(mockSigninGoogle).toHaveBeenCalledWith("/courses", "signup")
    );
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ title: "Welcome!" }));
    expect(mockNavigate).toHaveBeenCalledWith("/courses");
  });

  it("replaces unsafe Google returnTo values with the dashboard fallback", async () => {
    mockSigninGoogle.mockResolvedValue(completedUser);
    renderSignup("?returnTo=https://evil.example/path");
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(mockSigninGoogle).toHaveBeenCalledWith("/dashboard", "signup")
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("shows an error when Google signup fails", async () => {
    mockSigninGoogle.mockRejectedValue(new Error("OAuth failed"));
    renderSignup();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByText("Couldn't sign in with Google")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
