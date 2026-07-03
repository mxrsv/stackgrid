export interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
}

export type SidebarPosition = "left" | "top";

export interface Settings {
  fontFamily: string;
  fontSize: number;
  themeId: string;
  colorOverrides: Partial<TerminalColors>;
  sidebarPosition: SidebarPosition;
}

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;

export const FONT_FALLBACK = "Menlo, Monaco, monospace";

export const COLOR_KEYS = [
  "background",
  "foreground",
  "cursor",
  "selectionBackground",
] as const;

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: "SF Mono",
  fontSize: 13,
  themeId: "tokyo-night",
  colorOverrides: {},
  sidebarPosition: "left",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(size)));
}

function validateColorOverrides(raw: unknown): Partial<TerminalColors> {
  if (typeof raw !== "object" || raw === null) {
    return {};
  }
  const source = raw as Record<string, unknown>;
  const result: Partial<TerminalColors> = {};
  for (const key of COLOR_KEYS) {
    const value = source[key];
    if (isHexColor(value)) {
      result[key] = value;
    }
  }
  return result;
}

/** Validate data read from the store — invalid fields fall back to defaults. */
export function validateSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_SETTINGS;
  }
  const source = raw as Record<string, unknown>;
  return {
    fontFamily:
      typeof source.fontFamily === "string" && source.fontFamily.trim() !== ""
        ? source.fontFamily
        : DEFAULT_SETTINGS.fontFamily,
    fontSize:
      typeof source.fontSize === "number" && Number.isFinite(source.fontSize)
        ? clampFontSize(source.fontSize)
        : DEFAULT_SETTINGS.fontSize,
    themeId:
      typeof source.themeId === "string"
        ? source.themeId
        : DEFAULT_SETTINGS.themeId,
    colorOverrides: validateColorOverrides(source.colorOverrides),
    sidebarPosition:
      source.sidebarPosition === "left" || source.sidebarPosition === "top"
        ? source.sidebarPosition
        : DEFAULT_SETTINGS.sidebarPosition,
  };
}
