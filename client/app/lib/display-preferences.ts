import type { TextSizePreference, ThemePreference, User } from "./api/types";

export type ResolvedTheme = "light" | "dark";

export interface DisplayPreferences {
  theme_preference: ThemePreference;
  text_size_preference: TextSizePreference;
  reduce_motion: boolean;
}

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  theme_preference: "light",
  text_size_preference: "md",
  reduce_motion: false,
};

const DARK_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#FBF5E9",
  dark: "#15131F",
};

export function displayPreferencesFromUser(
  user: Pick<
    User,
    "theme_preference" | "text_size_preference" | "reduce_motion"
  > | null | undefined
): DisplayPreferences {
  if (!user) return DEFAULT_DISPLAY_PREFERENCES;
  return {
    theme_preference: user.theme_preference,
    text_size_preference: user.text_size_preference,
    reduce_motion: user.reduce_motion,
  };
}

export function resolveThemePreference(
  preference: ThemePreference,
  targetWindow: Pick<Window, "matchMedia"> | undefined =
    typeof window === "undefined" ? undefined : window
): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;

  try {
    return targetWindow?.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyDisplayPreferences(
  preferences: Partial<DisplayPreferences> | null | undefined
): ResolvedTheme {
  const next = { ...DEFAULT_DISPLAY_PREFERENCES, ...preferences };
  const theme = resolveThemePreference(next.theme_preference);

  if (typeof document === "undefined") return theme;

  document.body.dataset.theme = theme;
  document.body.dataset.themePreference = next.theme_preference;
  document.body.dataset.textSize = next.text_size_preference;
  document.body.dataset.reduceMotion = next.reduce_motion ? "true" : "false";
  document.documentElement.style.colorScheme = theme;

  const metaThemeColor =
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.content = THEME_COLORS[theme];
  }

  return theme;
}

export function watchAutoThemePreference(
  preferences: DisplayPreferences
): (() => void) | undefined {
  if (
    preferences.theme_preference !== "auto" ||
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return undefined;
  }

  const media = window.matchMedia(DARK_QUERY);
  const applyAutoPreference = () => applyDisplayPreferences(preferences);
  media.addEventListener?.("change", applyAutoPreference);
  return () => media.removeEventListener?.("change", applyAutoPreference);
}
