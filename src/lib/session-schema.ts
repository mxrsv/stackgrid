import type { SerializedNode } from "./split-tree";
import { isTabDotColor, type TabDotColor } from "./tab-colors";
import { validateLayout } from "./layout-validation";

export const SESSION_VERSION = 1;

// Sanity bounds so a corrupt file cannot spawn hundreds of shells
const MAX_RESTORED_TABS = 16;

export interface SessionTab {
  readonly layout: SerializedNode;
  /** Custom tab name override — restored by tab order, not by key. */
  readonly name?: string;
  /** Custom tab dot color token — restored by tab order, not by key. */
  readonly dotColor?: TabDotColor;
}

export interface SessionData {
  readonly version: number;
  readonly activeTab: number;
  readonly tabs: readonly SessionTab[];
}

const MAX_TAB_NAME_LENGTH = 64;

function validateTabName(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_TAB_NAME_LENGTH) {
    return undefined;
  }
  return trimmed;
}

/** null = corrupt/missing/foreign version — the caller starts with a fresh tab. */
export function validateSession(raw: unknown): SessionData | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  if (source.version !== SESSION_VERSION) {
    return null;
  }
  if (
    !Array.isArray(source.tabs) ||
    source.tabs.length === 0 ||
    source.tabs.length > MAX_RESTORED_TABS
  ) {
    return null;
  }
  const tabs: SessionTab[] = [];
  for (const rawTab of source.tabs) {
    if (typeof rawTab !== "object" || rawTab === null) {
      return null;
    }
    const layout = validateLayout(
      (rawTab as Record<string, unknown>).layout,
      0,
    );
    if (layout === null) {
      return null;
    }
    const tabSource = rawTab as Record<string, unknown>;
    const name = validateTabName(tabSource.name);
    const dotColor = isTabDotColor(tabSource.dotColor)
      ? tabSource.dotColor
      : undefined;
    tabs.push({
      layout,
      ...(name !== undefined ? { name } : {}),
      ...(dotColor !== undefined ? { dotColor } : {}),
    });
  }
  const activeTab =
    typeof source.activeTab === "number" &&
    Number.isInteger(source.activeTab) &&
    source.activeTab >= 0 &&
    source.activeTab < tabs.length
      ? source.activeTab
      : 0;
  return { version: SESSION_VERSION, activeTab, tabs };
}
