import type { ReactNode } from "react";
import { IconArrowRight } from "./Icons";
import { FeatureIcon } from "./Mascot";

interface CourseCardProps {
  title: string;
  description: string;
  accent: string;
  accentSoft: string;
  icon: ReactNode;
  meta: string;
  onClick: () => void;
  large?: boolean;
}

export const CourseCard = ({
  title,
  description,
  accent,
  accentSoft,
  icon,
  meta,
  onClick,
  large,
}: CourseCardProps) => (
  <button
    type="button"
    className="card"
    onClick={onClick}
    style={{
      cursor: "pointer",
      display: "block",
      width: "100%",
      padding: large ? 28 : 20,
      transition: "transform .15s, box-shadow .15s",
      position: "relative",
      overflow: "hidden",
      textAlign: "left",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-2px)";
      e.currentTarget.style.boxShadow = "var(--shadow)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "";
      e.currentTarget.style.boxShadow = "";
    }}
  >
    <div className="row gap-12" style={{ marginBottom: 12 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: accentSoft,
          color: accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div className="chip" style={{ marginLeft: "auto" }}>
        {meta}
      </div>
    </div>
    <h3 style={{ marginBottom: 6, fontSize: large ? 26 : 20 }}>{title}</h3>
    <p
      style={{
        color: "var(--ink-3)",
        fontSize: large ? 15 : 13.5,
        lineHeight: 1.5,
      }}
    >
      {description}
    </p>
    <div
      className="row gap-6"
      style={{
        marginTop: 14,
        color: accent,
        fontWeight: 600,
        fontSize: 13.5,
      }}
    >
      Roll a new task <IconArrowRight size={14} />
    </div>
  </button>
);

interface BigCourseCardProps {
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  accentSoft: string;
  illustration: ReactNode;
  meta: string;
  onClick: () => void;
}

export const BigCourseCard = ({
  title,
  subtitle,
  description,
  accent,
  accentSoft,
  illustration,
  meta,
  onClick,
}: BigCourseCardProps) => (
  <button
    type="button"
    className="card"
    onClick={onClick}
    style={{
      cursor: "pointer",
      display: "block",
      width: "100%",
      padding: 0,
      overflow: "hidden",
      transition: "transform .15s, box-shadow .15s",
      textAlign: "left",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "var(--shadow-lg)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "";
      e.currentTarget.style.boxShadow = "";
    }}
  >
    <div
      style={{
        background: accentSoft,
        padding: 28,
        position: "relative",
        height: 200,
        overflow: "hidden",
      }}
    >
      {illustration}
    </div>
    <div style={{ padding: 24 }}>
      <span
        className="chip"
        style={{
          background: accentSoft,
          color: accent,
          borderColor: "transparent",
        }}
      >
        {subtitle}
      </span>
      <h3 style={{ fontSize: 26, margin: "10px 0 8px" }}>{title}</h3>
      <p
        style={{
          color: "var(--ink-3)",
          fontSize: 14,
          lineHeight: 1.55,
          marginBottom: 14,
        }}
      >
        {description}
      </p>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{meta}</span>
        <span className="btn btn-primary btn-sm">
          Start a task <IconArrowRight size={12} />
        </span>
      </div>
    </div>
  </button>
);

export const ReadingIllustration = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    }}
  >
    <FeatureIcon name="stories" size={112} alt="" />
    <FeatureIcon name="words" size={92} alt="" style={{ marginTop: 36 }} />
  </div>
);

export const WritingIllustration = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
    }}
  >
    <FeatureIcon name="practice" size={112} alt="" />
    <FeatureIcon name="speak" size={92} alt="" style={{ marginTop: 36 }} />
  </div>
);
