import type { ReactNode } from "react";
import { BrandLogo, BrandMark, Mascot, type MascotPose } from "./Mascot";

interface AuthFrameProps {
  side: ReactNode;
  children: ReactNode;
}

export const AuthFrame = ({ side, children }: AuthFrameProps) => (
  <div
    style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "var(--paper)",
    }}
    className="auth-frame"
  >
    {side}
    <div
      className="auth-panel"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 32px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </div>
  </div>
);

interface AuthSideProps {
  title: string;
  subtitle: string;
  pose: MascotPose;
}

export const AuthSide = ({ title, subtitle, pose }: AuthSideProps) => (
  <div
    style={{
      background: "var(--ink)",
      color: "var(--paper)",
      padding: 48,
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}
    className="auth-side"
  >
    <BrandLogo width={164} className="brand-logo brand-logo-on-dark" />
    <div style={{ marginTop: "auto", position: "relative", zIndex: 2 }}>
      <h1
        style={{
          fontSize: 48,
          color: "var(--paper)",
          marginBottom: 14,
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: 17,
          color: "rgba(251,245,233,0.72)",
          maxWidth: 380,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
    <div
      className="auth-side-mascot"
      style={{ position: "absolute", right: -40, bottom: -20, opacity: 0.94 }}
    >
      <Mascot size={200} pose={pose} kind="ferret" />
    </div>
    <div
      className="auth-side-watermark"
      style={{ position: "absolute", right: 48, top: 48, opacity: 0.18 }}
    >
      <BrandMark size={280} color="var(--rust)" />
    </div>
  </div>
);
