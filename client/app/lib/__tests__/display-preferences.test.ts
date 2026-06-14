import { describe, expect, it } from "vitest";
import {
  applyDisplayPreferences,
  resolveThemePreference,
} from "../display-preferences";

function matchMediaWindow(matches: boolean): Pick<Window, "matchMedia"> {
  return {
    matchMedia: (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  };
}

describe("display preferences", () => {
  it("resolves explicit light and dark preferences without using system color scheme", () => {
    expect(resolveThemePreference("light", matchMediaWindow(true))).toBe("light");
    expect(resolveThemePreference("dark", matchMediaWindow(false))).toBe("dark");
  });

  it("resolves auto from prefers-color-scheme", () => {
    expect(resolveThemePreference("auto", matchMediaWindow(true))).toBe("dark");
    expect(resolveThemePreference("auto", matchMediaWindow(false))).toBe("light");
  });

  it("applies display preferences to the document body", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);

    applyDisplayPreferences({
      theme_preference: "dark",
      text_size_preference: "lg",
      reduce_motion: true,
    });

    expect(document.body.dataset.theme).toBe("dark");
    expect(document.body.dataset.themePreference).toBe("dark");
    expect(document.body.dataset.textSize).toBe("lg");
    expect(document.body.dataset.reduceMotion).toBe("true");
    expect(meta.content).toBe("#15131F");

    meta.remove();
  });
});
