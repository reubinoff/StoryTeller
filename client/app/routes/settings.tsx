import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { IconCheck } from "~/components/Icons";
import { Modal } from "~/components/Modal";
import { SettingsRow, SettingsSection } from "~/components/Settings";
import { Toggle } from "~/components/Toggle";
import { useToast } from "~/components/Toast";
import { api } from "~/lib/api/endpoints";
import {
  useChangePassword,
  useDeleteAccount,
  useUpdateProfile,
  useUploadAvatar,
} from "~/lib/api/queries";
import type {
  InterestId,
  TextSizePreference,
  ThemePreference,
} from "~/lib/api/types";
import { useAuth } from "~/lib/auth";
import {
  applyDisplayPreferences,
  displayPreferencesFromUser,
  watchAutoThemePreference,
} from "~/lib/display-preferences";
import { TOPICS } from "~/lib/topics";

export function meta() {
  return [{ title: "Settings · Storyteller" }];
}

type AccountModal = "email" | "password" | "connected" | "delete" | null;

export default function SettingsRoute() {
  const navigate = useNavigate();
  const { user, setUser, setInterests, signout } = useAuth();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const deleteAccount = useDeleteAccount();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accountModal, setAccountModal] = useState<AccountModal>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [interests, setLocalInterests] = useState<InterestId[]>(
    user?.interests ?? []
  );
  const [phone, setPhone] = useState(user?.phone_number ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [theme, setTheme] = useState<ThemePreference>(
    user?.theme_preference ?? "auto"
  );
  const [textSize, setTextSize] = useState<TextSizePreference>(
    user?.text_size_preference ?? "md"
  );
  const [reduceMotion, setReduceMotion] = useState<boolean>(
    user?.reduce_motion ?? false
  );
  const [notifEmail, setNotifEmail] = useState<boolean>(
    user?.notif_email_enabled ?? true
  );
  const [notifApp, setNotifApp] = useState<boolean>(
    user?.notif_inapp_enabled ?? true
  );

  useEffect(() => {
    if (!user) return;

    const previewPreferences = {
      theme_preference: theme,
      text_size_preference: textSize,
      reduce_motion: reduceMotion,
    };

    applyDisplayPreferences(previewPreferences);
    const stopWatchingAutoTheme = watchAutoThemePreference(previewPreferences);

    return () => {
      stopWatchingAutoTheme?.();
      void applyDisplayPreferences(displayPreferencesFromUser(user));
    };
  }, [reduceMotion, textSize, theme, user]);

  if (!user) return null;
  const avatarSrc = avatarImageUrl(user.avatar_url);

  const toggleInterest = (id: InterestId) => {
    setLocalInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const onSave = async () => {
    try {
      const updated = await update.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        phone_number: phone || null,
        theme_preference: theme,
        text_size_preference: textSize,
        reduce_motion: reduceMotion,
        notif_email_enabled: notifEmail,
        notif_inapp_enabled: notifApp,
      });
      await setInterests(interests);
      setUser({ ...updated, interests });
      push({ icon: "✓", title: "Saved" });
      navigate("/dashboard");
    } catch {
      push({ icon: "⚠️", title: "Couldn't save settings" });
    }
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      push({ icon: "⚠️", title: "Use PNG, JPEG, or WebP" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      push({ icon: "⚠️", title: "Avatar must be 2 MiB or smaller" });
      return;
    }
    try {
      const res = await uploadAvatar.mutateAsync(file);
      setUser({ ...user, avatar_url: res.avatar_url });
      push({ icon: "✓", title: "Avatar updated" });
    } catch {
      push({ icon: "⚠️", title: "Couldn't update avatar" });
    }
  };

  const onChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      push({ icon: "⚠️", title: "Passwords do not match" });
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setAccountModal(null);
      push({ icon: "✓", title: "Password updated" });
    } catch {
      push({ icon: "⚠️", title: "Couldn't update password" });
    }
  };

  const onDeleteAccount = async () => {
    try {
      await deleteAccount.mutateAsync();
      signout();
      push({ icon: "✓", title: "Account deleted" });
      navigate("/");
    } catch {
      push({ icon: "⚠️", title: "Couldn't delete account" });
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h1 className="page-title" style={{ fontSize: 42, marginBottom: 8 }}>
        Settings
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: 15, marginBottom: 32 }}>
        Manage your profile, interests, and how the app feels.
      </p>

      <SettingsSection title="Profile" subtitle="Used across the app">
        <div className="row gap-16 settings-profile-row" style={{ marginBottom: 14, paddingTop: 6 }}>
          {avatarSrc ? (
            <img className="settings-avatar-img" src={avatarSrc} alt="" />
          ) : (
            <div className="settings-avatar-fallback">{user.first_name[0]}</div>
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {firstName} {lastName}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              {user.email}
            </div>
            <input
              ref={fileInputRef}
              className="sr"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onAvatarChange}
            />
            <button
              type="button"
              className="btn btn-soft btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
            >
              {uploadAvatar.isPending ? "Uploading..." : "Change avatar"}
            </button>
          </div>
        </div>
        <div className="row gap-16 settings-form-row">
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="settings-first-name">
              First name
            </label>
            <input
              id="settings-first-name"
              className="field-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="settings-last-name">
              Last name
            </label>
            <input
              id="settings-last-name"
              className="field-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="row gap-16 settings-form-row" style={{ marginTop: 14, paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="settings-year-of-birth">
              Year of birth
            </label>
            <input
              id="settings-year-of-birth"
              className="field-input"
              value={user.year_of_birth}
              readOnly
              style={{ background: "var(--paper-2)" }}
            />
            <div className="field-help">Contact support to change this.</div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="settings-phone">
              Phone (optional)
            </label>
            <input
              id="settings-phone"
              className="field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 0100"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Interests"
        subtitle="Pick up to 6. We mix these into every task."
      >
        <div
          className="settings-interests-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0,1fr))",
            gap: 10,
            padding: "14px 0",
          }}
        >
          {TOPICS.map((t) => {
            const sel = interests.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleInterest(t.id)}
                aria-pressed={sel}
                style={{
                  padding: "12px 8px",
                  borderRadius: 14,
                  border:
                    "1.5px solid " + (sel ? "var(--teal)" : "var(--line)"),
                  background: sel ? "var(--teal-soft)" : "var(--paper)",
                  cursor: "pointer",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 4 }}>{t.emoji}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: sel ? "var(--teal)" : "var(--ink-2)",
                  }}
                >
                  {t.display_name}
                </div>
                {sel && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "var(--teal)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconCheck size={11} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-3)",
            paddingBottom: 14,
          }}
        >
          {interests.length} of 6 selected
        </div>
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow
          label="Email"
          desc={user.email}
          action={
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => setAccountModal("email")}
            >
              Change
            </button>
          }
        />
        <SettingsRow
          label="Password"
          desc="Use a strong password for email sign-in"
          action={
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => setAccountModal("password")}
            >
              Update
            </button>
          }
        />
        <SettingsRow
          label="Connected accounts"
          desc="Google sign-in is available"
          action={
            <button
              type="button"
              className="btn btn-soft btn-sm"
              onClick={() => setAccountModal("connected")}
            >
              Manage
            </button>
          }
        />
        <SettingsRow
          label="Delete account"
          desc="Permanently remove your data"
          action={
            <button
              type="button"
              className="btn btn-soft btn-sm"
              style={{ color: "var(--bad)" }}
              onClick={() => setAccountModal("delete")}
            >
              Delete
            </button>
          }
          last
        />
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingsRow
          label="Email reminders"
          desc="Daily nudge to keep your streak"
          action={<Toggle on={notifEmail} onChange={setNotifEmail} />}
        />
        <SettingsRow
          label="In-app notifications"
          desc="Toast when writing tasks finish processing"
          action={<Toggle on={notifApp} onChange={setNotifApp} />}
          last
        />
      </SettingsSection>

      <SettingsSection title="Display">
        <SettingsRow
          label="Theme"
          desc="Auto, Light, or Dark"
          action={
            <Segmented
              value={theme}
              onChange={(v) => setTheme(v as ThemePreference)}
              options={[
                { value: "auto", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          }
        />
        <SettingsRow
          label="Text size"
          desc="Affects body text and passages"
          action={
            <Segmented
              value={textSize}
              onChange={(v) => setTextSize(v as TextSizePreference)}
              options={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]}
            />
          }
        />
        <SettingsRow
          label="Reduce motion"
          desc="Limit animations and transitions"
          action={<Toggle on={reduceMotion} onChange={setReduceMotion} />}
          last
        />
      </SettingsSection>

      <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
        <button
          className="btn btn-accent btn-lg"
          onClick={onSave}
          disabled={update.isPending}
        >
          {update.isPending ? (
            <span className="row gap-8">
              <span className="spinner" /> Saving…
            </span>
          ) : (
            <>
              <IconCheck size={14} /> Save changes
            </>
          )}
        </button>
      </div>
      <InfoModal
        open={accountModal === "email"}
        title="Email changes"
        onClose={() => setAccountModal(null)}
      >
        Email changes need support verification right now. Contact support and
        keep using your current email until they confirm the update.
      </InfoModal>
      <Modal
        open={accountModal === "password"}
        onClose={() => setAccountModal(null)}
        ariaLabel="Update password"
      >
        <h2 style={{ marginTop: 0 }}>Update password</h2>
        <div className="col gap-12">
          <label>
            <span className="field-label">Current password</span>
            <input
              className="field-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">New password</span>
            <input
              className="field-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">Confirm new password</span>
            <input
              className="field-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => setAccountModal(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-accent"
            onClick={onChangePassword}
            disabled={
              changePassword.isPending ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
          >
            {changePassword.isPending ? "Updating..." : "Update password"}
          </button>
        </div>
      </Modal>
      <InfoModal
        open={accountModal === "connected"}
        title="Connected accounts"
        onClose={() => setAccountModal(null)}
      >
        Google sign-in is supported, but self-service account linking and
        unlinking are not available yet. Contact support if this account is
        connected incorrectly.
      </InfoModal>
      <Modal
        open={accountModal === "delete"}
        onClose={() => setAccountModal(null)}
        ariaLabel="Delete account"
      >
        <h2 style={{ marginTop: 0 }}>Delete account</h2>
        <p style={{ color: "var(--ink-3)", marginTop: 0 }}>
          This permanently disables your account and removes personal profile
          details from active use.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-soft"
            onClick={() => setAccountModal(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-soft"
            style={{ color: "var(--bad)" }}
            onClick={onDeleteAccount}
            disabled={deleteAccount.isPending}
          >
            {deleteAccount.isPending ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function avatarImageUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/api/v1/me/avatar")) {
    return `${api.me.avatarUrl()}${value.slice("/api/v1/me/avatar".length)}`;
  }
  return value;
}

function InfoModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel={title}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: "var(--ink-3)", marginTop: 0 }}>{children}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-accent" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

interface SegmentedProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

const Segmented = ({ value, onChange, options }: SegmentedProps) => (
  <div
    className="row gap-4 settings-segmented"
    style={{ background: "var(--paper-2)", borderRadius: 999, padding: 3 }}
  >
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        style={{
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 600,
          background: value === o.value ? "var(--ink)" : "transparent",
          color: value === o.value ? "var(--paper)" : "var(--ink-2)",
        }}
      >
        {o.label}
      </button>
    ))}
  </div>
);
