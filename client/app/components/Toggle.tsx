interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
}

export const Toggle = ({ on, onChange, ariaLabel }: ToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    aria-pressed={on}
    aria-label={ariaLabel}
    style={{
      width: 50,
      height: 30,
      borderRadius: 999,
      background: on ? "var(--teal)" : "var(--line-strong)",
      position: "relative",
      transition: "background .15s",
      cursor: "pointer",
      border: "none",
      flex: "0 0 50px",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 3,
        left: on ? 23 : 3,
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        transition: "left .15s",
      }}
    />
  </button>
);
