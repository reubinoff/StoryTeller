import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const SettingsSection = ({
  title,
  subtitle,
  children,
}: SettingsSectionProps) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 20, marginBottom: 2 }}>{title}</h3>
      {subtitle && (
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{subtitle}</div>
      )}
    </div>
    <div className="card" style={{ padding: "8px 24px" }}>
      {children}
    </div>
  </div>
);

interface SettingsRowProps {
  label: string;
  desc?: string;
  action?: ReactNode;
  last?: boolean;
}

export const SettingsRow = ({ label, desc, action, last }: SettingsRowProps) => (
  <div
    className="row"
    style={{
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px 0",
      borderBottom: last ? "none" : "1px solid var(--line)",
      gap: 24,
    }}
  >
    <div>
      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{label}</div>
      {desc && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{desc}</div>}
    </div>
    <div>{action}</div>
  </div>
);
