import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  radius?: number;
}

export const Skeleton = ({
  width = "100%",
  height = 16,
  style,
  radius = 8,
}: SkeletonProps) => (
  <div
    className="skeleton"
    aria-hidden="true"
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

export const CardSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="card">
    <Skeleton height={20} width="40%" style={{ marginBottom: 12 }} />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton
        key={i}
        height={14}
        width={i === rows - 1 ? "60%" : "100%"}
        style={{ marginBottom: 8 }}
      />
    ))}
  </div>
);
