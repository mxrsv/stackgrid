/**
 * Theme-derived chrome color system (app-wide standard).
 *
 * All chrome UI derives from the terminal theme's bg/fg — no hardcoded
 * chrome colors. Text tokens are raised toward the tone until they meet
 * WCAG contrast floors, so a low-contrast theme or user override can
 * never sink the chrome below readability.
 */

export interface ChromeColors {
  readonly tone: string;
  readonly chrome1: string;
  readonly chrome2: string;
  readonly tabActiveBg: string;
  readonly inputBg: string;
  readonly hair: string;
  readonly hairStrong: string;
  readonly textPrimary: string;
  readonly textMuted: string;
  readonly textFaint: string;
}

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

// Background luminance below this mixes toward white, otherwise black
const DARK_LUMINANCE_THRESHOLD = 0.45;
// Step size when raising a text color toward the tone (2% per step)
const RAISE_STEP = 0.02;

function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number): string => n.toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Linear interpolation from base toward target; amount in [0, 1]. */
export function mixHex(base: string, target: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(target);
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount),
  });
}

/** WCAG relative luminance in [0, 1]. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (n: number): number => {
    const s = n / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio in [1, 21]. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Mix `text` toward `tone` in small steps until it meets `floor` against
 * every surface. Caps at the tone itself when the floor is unreachable
 * (mid-gray backgrounds) — best achievable contrast wins.
 */
function ensureContrast(
  text: string,
  surfaces: readonly string[],
  floor: number,
  tone: string,
): string {
  for (let t = 0; t <= 1; t += RAISE_STEP) {
    const candidate = mixHex(text, tone, t);
    if (surfaces.every((s) => contrastRatio(candidate, s) >= floor)) {
      return candidate;
    }
  }
  return tone;
}

function alpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Derive every chrome token from the theme's background and foreground. */
export function deriveChromeColors(bg: string, fg: string): ChromeColors {
  const dark = luminance(bg) < DARK_LUMINANCE_THRESHOLD;
  const tone = dark ? "#ffffff" : "#000000";
  const chrome1 = mixHex(bg, tone, 0.04);
  const chrome2 = mixHex(bg, tone, 0.07);
  const tabActiveBg = mixHex(bg, tone, 0.15);
  // Kept soft on light themes — readability comes from the textPrimary floor
  const inputBg = mixHex(bg, tone, dark ? 0.12 : 0.06);
  return {
    tone,
    chrome1,
    chrome2,
    tabActiveBg,
    inputBg,
    hair: alpha(fg, 0.12),
    hairStrong: alpha(fg, 0.2),
    textPrimary: ensureContrast(fg, [inputBg, chrome2], 4.5, tone),
    textMuted: ensureContrast(mixHex(bg, fg, 0.52), [chrome1], 4.5, tone),
    textFaint: ensureContrast(mixHex(bg, fg, 0.34), [chrome1], 3, tone),
  };
}
