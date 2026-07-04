import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  deriveChromeColors,
  luminance,
  mixHex,
} from "./derive-colors";
import { THEME_PRESETS } from "../settings/themes";

describe("luminance", () => {
  it("is 1 for white and 0 for black", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#000000")).toBeCloseTo(0, 5);
  });

  it("is ~0.2158 for #808080", () => {
    expect(luminance("#808080")).toBeCloseTo(0.2158, 3);
  });
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#16161e", "#c0caf5")).toBeCloseTo(
      contrastRatio("#c0caf5", "#16161e"),
      5,
    );
  });
});

describe("mixHex", () => {
  it("returns base at 0 and target at 1", () => {
    expect(mixHex("#16161e", "#ffffff", 0)).toBe("#16161e");
    expect(mixHex("#16161e", "#ffffff", 1)).toBe("#ffffff");
  });

  it("mixes black and white to mid gray", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("deriveChromeColors", () => {
  it("mixes toward white on dark backgrounds, black on light ones", () => {
    expect(deriveChromeColors("#16161e", "#c0caf5").tone).toBe("#ffffff");
    expect(deriveChromeColors("#ffffff", "#333333").tone).toBe("#000000");
  });

  it("emits alpha hairlines from the foreground", () => {
    const chrome = deriveChromeColors("#16161e", "#c0caf5");
    expect(chrome.hair).toBe("rgba(192, 202, 245, 0.12)");
    expect(chrome.hairStrong).toBe("rgba(192, 202, 245, 0.2)");
  });

  // The spec's contrast floors — the app-wide standard. Every preset plus
  // the known-bad overrides must pass.
  const cases: Array<{ label: string; bg: string; fg: string }> = [
    ...THEME_PRESETS.map((preset) => ({
      label: preset.label,
      bg: preset.theme.background,
      fg: preset.theme.foreground,
    })),
    // Tokyo Night comment color used as fg override (1.02:1 raw on inputs)
    { label: "low-contrast fg override", bg: "#1a1b26", fg: "#565f89" },
    // Light background override that broke the old white-mix chrome
    { label: "light bg override", bg: "#ffffff", fg: "#c0caf5" },
    { label: "light bg, light fg", bg: "#fafafa", fg: "#e0e0e0" },
  ];

  for (const { label, bg, fg } of cases) {
    it(`meets all contrast floors for ${label}`, () => {
      const c = deriveChromeColors(bg, fg);
      expect(contrastRatio(c.textPrimary, c.inputBg)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(c.textPrimary, c.chrome2)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(c.textMuted, c.chrome1)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.textFaint, c.chrome1)).toBeGreaterThanOrEqual(3);
    });
  }

  it("keeps a high-contrast fg unchanged as textPrimary", () => {
    // Tokyo Night fg is already >> 4.5:1 on its surfaces — no raise needed
    expect(deriveChromeColors("#16161e", "#c0caf5").textPrimary).toBe(
      "#c0caf5",
    );
  });
});
