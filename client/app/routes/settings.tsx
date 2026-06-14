import { useEffect, useState } from "react";
import { IconCheck } from "~/components/Icons";
import { SettingsRow, SettingsSection } from "~/components/Settings";
import { Toggle } from "~/components/Toggle";
import { useToast } from "~/components/Toast";
import { useUpdateProfile } from "~/lib/api/queries";
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

export default function SettingsRoute() {
  const { user, setUser, setInterests } = useAuth();
  const update = useUpdateProfile();
  const { push } = useToast();
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
    } catch {
      push({ icon: "⚠️", title: "Couldn't save settings" });
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <h1 style={{ fontSize: 42, marginBottom: 8 }}>Settings</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 15, marginBottom: 32 }}>
        Manage your profile, interests, and how the app feels.
      </p>

      <SettingsSection title="Profile" subtitle="Used across the app">
        <div className="row gap-16" style={{ marginBottom: 14, paddingTop: 6 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--teal)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {user.first_name[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>
              {firstName} {lastName}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              {user.email}
            </div>
            <button className="btn btn-soft btn-sm" style={{ marginTop: 8 }}>
              Change avatar
            </button>
          </div>
        </div>
        <div className="row gap-16">
          <div style={{ flex: 1 }}>
            <label className="field-label">First name</label>
            <input
              className="field-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Last name</label>
            <input
              className="field-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="row gap-16" style={{ marginTop: 14, paddingBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Year of birth</label>
            <input
              className="field-input"
              value={user.year_of_birth}
              readOnly
              style={{ background: "var(--paper-2)" }}
            />
            <div className="field-help">Contact support to change this.</div>
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">Phone (optional)</label>
            <input
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
          action={<button className="btn btn-soft btn-sm">Change</button>}
        />
        <SettingsRow
          label="Password"
          desc="Last changed 3 months ago"
          action={<button className="btn btn-soft btn-sm">Update</button>}
        />
        <SettingsRow
          label="Connected accounts"
          desc="Google linked"
          action={<button className="btn btn-soft btn-sm">Manage</button>}
        />
        <SettingsRow
          label="Delete account"
          desc="Permanently remove your data"
          action={
            <button
              className="btn btn-soft btn-sm"
              style={{ color: "var(--bad)" }}
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
    </div>
  );
}

interface SegmentedProps {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

const Segmented = ({ value, onChange, options }: SegmentedProps) => (
  <div
    className="row gap-4"
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
