import type { ReactNode } from "react";
import { IconArrowRight } from "./Icons";
import { Ferret } from "./Mascot";

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
  <div
    className="card"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") onClick();
    }}
    style={{
      cursor: "pointer",
      padding: large ? 28 : 20,
      transition: "transform .15s, box-shadow .15s",
      position: "relative",
      overflow: "hidden",
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
  </div>
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
  <div
    className="card"
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") onClick();
    }}
    style={{
      cursor: "pointer",
      padding: 0,
      overflow: "hidden",
      transition: "transform .15s, box-shadow .15s",
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
        <button className="btn btn-primary btn-sm">
          Start a task <IconArrowRight size={12} />
        </button>
      </div>
    </div>
  </div>
);

export const ReadingIllustration = () => (
  <svg
    viewBox="0 0 320 160"
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0 }}
  >
    <rect
      x={40}
      y={40}
      width={120}
      height={100}
      rx={6}
      fill="var(--paper)"
      stroke="var(--ink)"
      strokeWidth={2}
    />
    <rect
      x={160}
      y={40}
      width={120}
      height={100}
      rx={6}
      fill="var(--paper-2)"
      stroke="var(--ink)"
      strokeWidth={2}
    />
    <line
      x1={160}
      y1={40}
      x2={160}
      y2={140}
      stroke="var(--ink)"
      strokeWidth={2}
    />
    {[55, 67, 79, 91, 103, 115].map((y) => (
      <line
        key={y}
        x1={50}
        y1={y}
        x2={150}
        y2={y}
        stroke="var(--teal)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={y > 110 ? 0.4 : 1}
      />
    ))}
    {[55, 67, 79, 91, 103, 115].map((y) => (
      <line
        key={`b-${y}`}
        x1={170}
        y1={y}
        x2={270}
        y2={y}
        stroke="var(--teal)"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={y > 110 ? 0.4 : 1}
      />
    ))}
    <g transform="translate(238 90)">
      <Ferret size={60} pose="read" />
    </g>
  </svg>
);

export const WritingIllustration = () => (
  <svg
    viewBox="0 0 320 160"
    width="100%"
    height="100%"
    style={{ position: "absolute", inset: 0 }}
  >
    <rect
      x={60}
      y={30}
      width={200}
      height={120}
      rx={6}
      fill="var(--paper)"
      stroke="var(--ink)"
      strokeWidth={2}
    />
    {[50, 64, 78, 92, 106, 120, 134].map((y, i) => (
      <line
        key={y}
        x1={74}
        y1={y}
        x2={74 + (i === 6 ? 80 : 170)}
        y2={y}
        stroke="var(--rust)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    ))}
    <g transform="translate(220 14) rotate(35)">
      <rect
        x={0}
        y={0}
        width={6}
        height={80}
        fill="var(--rust)"
        stroke="var(--ink)"
        strokeWidth={2}
      />
      <polygon points="0,80 6,80 3,92" fill="var(--ink)" />
    </g>
  </svg>
);
