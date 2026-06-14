import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsRoute from "../settings";
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

const mockUpdateProfile = vi.fn();

vi.mock("~/lib/api/queries", () => ({
  useUpdateProfile: () => ({
    mutateAsync: mockUpdateProfile,
    isPending: false,
  }),
}));

const mockSetUser = vi.fn();
const mockSetInterests = vi.fn();
let mockUser: User;

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: mockUser,
    setUser: mockSetUser,
    setInterests: mockSetInterests,
  }),
}));

function setSystemDarkMode(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const baseUser: User = {
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

beforeEach(() => {
  vi.resetAllMocks();
  setSystemDarkMode(false);
  mockUser = { ...baseUser };
  mockSetInterests.mockResolvedValue(undefined);
  mockUpdateProfile.mockResolvedValue(mockUser);
  document.body.dataset.theme = "light";
  document.body.dataset.themePreference = "auto";
  document.body.dataset.textSize = "md";
  document.body.dataset.reduceMotion = "false";
});

describe("SettingsRoute", () => {
  it("previews dark theme immediately and persists it in the profile payload", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({
      ...mockUser,
      theme_preference: "dark",
    });

    render(<SettingsRoute />);

    await user.click(screen.getByRole("button", { name: "Dark" }));
    await waitFor(() => expect(document.body.dataset.theme).toBe("dark"));
    expect(document.body.dataset.themePreference).toBe("dark");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ theme_preference: "dark" })
      )
    );
    expect(mockSetInterests).toHaveBeenCalledWith(["animals"]);
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        theme_preference: "dark",
        interests: ["animals"],
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
