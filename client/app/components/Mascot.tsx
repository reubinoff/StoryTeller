import type { CSSProperties } from "react";

export type MascotPose =
  | "wave"
  | "cheer"
  | "read"
  | "write"
  | "sleep"
  | "thinking";
export type MascotMood = "happy" | "closed" | "thinking";
export type MascotKind = "ferret" | "owl";

export const BRAND_ASSETS = {
  logo: "/brand/logo.svg",
  appIcon: "/brand/app-icon.svg",
  favicon: "/brand/favicon.svg",
  mascot: "/brand/mascot.svg",
  stories: "/brand/stories.svg",
  words: "/brand/words.svg",
  listen: "/brand/listen.svg",
  speak: "/brand/speak.svg",
  practice: "/brand/practice.svg",
  streak: "/brand/streak.svg",
  icons: "/brand/icons.svg",
} as const;

export type BrandAssetName = keyof typeof BRAND_ASSETS;

interface BrandImageProps {
  name: BrandAssetName;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number | string;
  height?: number | string;
  decorative?: boolean;
}

export const BrandImage = ({
  name,
  alt,
  className,
  style,
  width,
  height,
  decorative = false,
}: BrandImageProps) => (
  <img
    src={BRAND_ASSETS[name]}
    alt={decorative ? "" : alt ?? ""}
    aria-hidden={decorative || !alt ? true : undefined}
    className={className}
    style={style}
    width={width}
    height={height}
    draggable={false}
  />
);

export const BrandLogo = ({
  width = 168,
  className = "brand-logo",
  style,
  alt = "Storyteller",
}: {
  width?: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) => {
  const height = Math.round(width * (260 / 860));
  return (
    <BrandImage
      name="logo"
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={{ width, height, ...style }}
    />
  );
};

export const BrandMark = ({
  size = 32,
}: {
  size?: number;
  color?: string;
}) => (
  <BrandImage
    name="favicon"
    alt=""
    decorative
    className="brand-mark-img"
    width={size}
    height={size}
    style={{ width: size, height: size }}
  />
);

export interface MascotProps {
  size?: number;
  pose?: MascotPose;
  mood?: MascotMood;
  kind?: MascotKind;
  className?: string;
  style?: CSSProperties;
}

export const Mascot = ({
  size = 120,
  className = "mascot-img",
  style,
}: MascotProps) => (
  <BrandImage
    name="mascot"
    alt=""
    decorative
    className={className}
    width={size}
    height={size}
    style={{ width: size, height: size, objectFit: "contain", ...style }}
  />
);

export const FeatureIcon = ({
  name,
  size = 72,
  alt,
  className = "feature-brand-icon",
  style,
}: {
  name: Extract<
    BrandAssetName,
    "stories" | "words" | "listen" | "speak" | "practice" | "streak"
  >;
  size?: number;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) => (
  <BrandImage
    name={name}
    alt={alt}
    decorative={!alt}
    className={className}
    width={size}
    height={size}
    style={{ width: size, height: size, objectFit: "contain", ...style }}
  />
);

export const Ferret = Mascot;
export const Owl = Mascot;
