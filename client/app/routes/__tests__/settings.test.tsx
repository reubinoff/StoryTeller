import { render, screen, waitFor, within } from "@testing-library/react";
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
const mockChangePassword = vi.fn();
const mockUploadAvatar = vi.fn();
const mockDeleteAccount = vi.fn();

vi.mock("~/lib/api/queries", () => ({
  useUpdateProfile: () => ({
    mutateAsync: mockUpdateProfile,
    isPending: false,
  }),
  useChangePassword: () => ({
    mutateAsync: mockChangePassword,
    isPending: false,
  }),
  useUploadAvatar: () => ({
    mutateAsync: mockUploadAvatar,
    isPending: false,
  }),
  useDeleteAccount: () => ({
    mutateAsync: mockDeleteAccount,
    isPending: false,
  }),
}));

const mockSetUser = vi.fn();
const mockSetInterests = vi.fn();
const mockSignout = vi.fn();
let mockUser: User;

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: mockUser,
    setUser: mockSetUser,
    setInterests: mockSetInterests,
    signout: mockSignout,
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
  mockChangePassword.mockResolvedValue(null);
  mockUploadAvatar.mockResolvedValue({ avatar_url: "/api/v1/me/avatar?version=1" });
  mockDeleteAccount.mockResolvedValue(null);
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
        expect.objectContaining({ theme_preference: "dark" }),
      ),
    );
    expect(mockSetInterests).toHaveBeenCalledWith(["animals"]);
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        theme_preference: "dark",
        interests: ["animals"],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("saves profile preferences, interests, and notification choices", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockResolvedValue({
      ...mockUser,
      first_name: "Mira",
      last_name: "Stone",
      phone_number: "+1 555 0100",
      text_size_preference: "lg",
      reduce_motion: true,
      notif_email_enabled: false,
      notif_inapp_enabled: false,
    });

    render(<SettingsRoute />);

    const firstNameInput = screen.getByDisplayValue("Maya");
    const lastNameInput = screen.getByDisplayValue("Patel");
    const phoneInput = screen.getByPlaceholderText("+1 555 0100");

    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Mira");
    await user.clear(lastNameInput);
    await user.type(lastNameInput, "Stone");
    await user.type(phoneInput, "+1 555 0100");
    await user.click(screen.getByRole("button", { name: "Large" }));
    await user.click(rowActionButton("Reduce motion"));
    await user.click(rowActionButton("Email reminders"));
    await user.click(rowActionButton("In-app notifications"));
    await user.click(screen.getByRole("button", { name: /animals & pets/i }));
    await user.click(
      screen.getByRole("button", { name: /space & astronomy/i }),
    );

    expect(
      screen.getByRole("button", { name: /animals & pets/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: /space & astronomy/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 of 6 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        first_name: "Mira",
        last_name: "Stone",
        phone_number: "+1 555 0100",
        theme_preference: "auto",
        text_size_preference: "lg",
        reduce_motion: true,
        notif_email_enabled: false,
        notif_inapp_enabled: false,
      }),
    );
    expect(mockSetInterests).toHaveBeenCalledWith(["space"]);
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Mira",
        last_name: "Stone",
        phone_number: "+1 555 0100",
        interests: ["space"],
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a toast and stays put when saving fails", async () => {
    const user = userEvent.setup();
    mockUpdateProfile.mockRejectedValue(new Error("save failed"));

    render(<SettingsRoute />);

    await user.click(screen.getByRole("button", { name: "Small" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        icon: "⚠️",
        title: "Couldn't save settings",
      }),
    );
    expect(mockSetInterests).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("uploads a valid avatar and updates the user", async () => {
    const user = userEvent.setup();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    render(<SettingsRoute />);

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Missing avatar file input");
    await user.upload(input, file);

    await waitFor(() => expect(mockUploadAvatar).toHaveBeenCalledWith(file));
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: "/api/v1/me/avatar?version=1" }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      icon: "✓",
      title: "Avatar updated",
    });
  });

  it("changes the password from the account modal", async () => {
    const user = userEvent.setup();

    render(<SettingsRoute />);

    await user.click(rowActionButton("Password"));
    const dialog = screen.getByRole("dialog", { name: "Update password" });
    await user.type(within(dialog).getByLabelText("Current password"), "Oldpass1");
    await user.type(within(dialog).getByLabelText("New password"), "Newpass2");
    await user.type(
      within(dialog).getByLabelText("Confirm new password"),
      "Newpass2",
    );
    await user.click(within(dialog).getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mockChangePassword).toHaveBeenCalledWith({
        current_password: "Oldpass1",
        new_password: "Newpass2",
      }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      icon: "✓",
      title: "Password updated",
    });
  });

  it("deletes the account after confirmation", async () => {
    const user = userEvent.setup();

    render(<SettingsRoute />);

    await user.click(rowActionButton("Delete account"));
    const dialog = screen.getByRole("dialog", { name: "Delete account" });
    await user.click(within(dialog).getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalled());
    expect(mockSignout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("shows honest messaging for unsupported email changes", async () => {
    const user = userEvent.setup();

    render(<SettingsRoute />);

    await user.click(rowActionButton("Email"));

    expect(
      screen.getByRole("dialog", { name: "Email changes" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/need support verification/i)).toBeInTheDocument();
  });
});

function rowActionButton(label: string): HTMLButtonElement {
  const row = screen.getByText(label).closest(".row");
  const button = row?.querySelector("button");
  if (!button) throw new Error(`No action button found for ${label}`);
  return button;
}
