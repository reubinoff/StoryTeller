import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export const SectionHeader = ({
  title,
  subtitle,
  action,
}: SectionHeaderProps) => (
  <div
    className="row section-header"
    style={{ alignItems: "flex-end", marginBottom: 16, gap: 16 }}
  >
    <div>
      <h2 style={{ fontSize: 26 }}>{title}</h2>
      {subtitle && (
        <div style={{ color: "var(--ink-3)", fontSize: 14, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
    <div className="section-header-action" style={{ marginLeft: "auto" }}>
      {action}
    </div>
  </div>
);
