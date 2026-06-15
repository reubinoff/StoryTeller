import type { CSSProperties, ReactNode } from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

interface BaseIconProps extends IconProps {
  children: ReactNode;
  viewBox?: string;
}

const Icon = ({
  children,
  size = 18,
  className = "",
  style,
  viewBox = "0 0 24 24",
}: BaseIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox={viewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const IconHome = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </Icon>
);
export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
    <path d="M4 19a2 2 0 0 0 2 2h13" />
  </Icon>
);
export const IconPen = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 19 7-7 3 3-7 7-3-3z" />
    <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="m2 2 7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </Icon>
);
export const IconReadingTask = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5c2.7 0 5 .7 8 2.3v12c-3-1.6-5.3-2.3-8-2.3v-12z" />
    <path d="M20 5.5c-2.7 0-5 .7-8 2.3v12c3-1.6 5.3-2.3 8-2.3v-12z" />
    <path d="M12 7.8v12" />
  </Icon>
);
export const IconWritingTask = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20z" />
    <path d="m14.8 6 3.2 3.2" />
    <path d="M4 20h5" />
  </Icon>
);
export const IconSettings = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const IconHelp = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 4.9.5c0 1.5-2.4 2-2.4 3.5" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </Icon>
);
export const IconSparkle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Icon>
);
export const IconFlame = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2.5-1.6-3.5C9 11 7.5 12 7 13a4 4 0 1 0 8 0 5 5 0 0 0-2-4 6 6 0 0 1-2 6c-1 0-2.5-1-2.5-2.5z" />
  </Icon>
);
export const IconTrophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 4h12v3a6 6 0 0 1-12 0V4z" />
    <path d="M18 5h2a2 2 0 0 1-2 4M6 5H4a2 2 0 0 0 2 4" />
    <path d="M9 14h6l1 4H8l1-4z" />
    <path d="M8 21h8" />
  </Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);
export const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6 18 18M18 6 6 18" />
  </Icon>
);
export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </Icon>
);
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
export const IconArrowRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 5l7 7-7 7" />
  </Icon>
);
export const IconArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 5 4 12l7 7" />
  </Icon>
);
export const IconVolume = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M16 9a4 4 0 0 1 0 6" />
    <path d="M19 6a8 8 0 0 1 0 12" />
  </Icon>
);
export const IconType = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16M9 6v14M15 10h6M18 10v10" />
  </Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
);
export const IconStar = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 3 6 6 .9-4.5 4.3 1 6.3L12 17.8 6.5 20.5l1-6.3L3 9.9 9 9z" />
  </Icon>
);
export const IconGoogle = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.5 12.27c0-.78-.07-1.53-.2-2.27H12v4.51h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.55c2.08-1.92 3.28-4.74 3.28-8.33z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.98.66-2.24 1.06-3.73 1.06-2.87 0-5.29-1.94-6.16-4.55H2.18v2.86A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.08a6.6 6.6 0 0 1 0-4.16V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.86z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.18 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.86C6.71 7.32 9.13 5.38 12 5.38z"
    />
  </svg>
);
export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const IconLogout = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);
export const IconCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </Icon>
);
export const IconTarget = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </Icon>
);
export const IconDoc = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8M8 17h6" />
  </Icon>
);
export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 13A9 9 0 0 1 11 3a7 7 0 1 0 10 10z" />
  </Icon>
);
export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);
