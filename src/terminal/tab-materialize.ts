import type { PaneProcessInfo } from "../lib/process-info";
import { SESSION_VERSION, type SessionData, type SessionTab } from "../lib/session-schema";
import type { SerializedNode } from "../lib/split-tree";
import type { TabDotColor } from "../lib/tab-colors";
import { freshPaneInfo } from "./pane-info";
import type { ClosedTabSnapshot } from "./closed-tabs";

/**
 * How per-pane CWDs are gathered when snapshotting or materializing a Tab.
 *
 * - `fresh` — one-shot `pty_info` (Layout preset save, Closed tab snapshot)
 * - `polled` — TabManager's 2s poll cache (chrome only; not for persistence)
 * - `none` — Session chrome: no CWDs; spawn falls back to `$HOME`
 * - `given` — caller already resolved CWDs (Open board, reopen stack)
 */
export type CwdPolicy = "fresh" | "polled" | "none" | "given";

/** Zip pane ids against a polled info map; null when unknown. Pure. */
export function zipPolledCwds(
    paneIds: readonly number[],
    infoByPane: ReadonlyMap<number, PaneProcessInfo>,
): readonly (string | null)[] {
    return paneIds.map((id) => infoByPane.get(id)?.cwd ?? null);
}

/** Zip pane ids against a fresh `pty_info` result list. Pure. */
export function zipFreshCwds(
    paneIds: readonly number[],
    infos: readonly PaneProcessInfo[],
): readonly (string | null)[] {
    const byId = new Map(infos.map((info) => [info.id, info] as const));
    return paneIds.map((id) => byId.get(id)?.cwd ?? null);
}

/**
 * Resolve per-pane CWDs under an explicit policy.
 * `given` returns `provided` (or [] when omitted).
 * `none` always returns [] — Session restore / chrome-only.
 */
export async function resolvePaneCwds(
    paneIds: readonly number[],
    policy: CwdPolicy,
    options: {
        polled?: ReadonlyMap<number, PaneProcessInfo>;
        provided?: readonly (string | null)[];
    } = {},
): Promise<readonly (string | null)[]> {
    switch (policy) {
        case "none":
            return [];
        case "given":
            return options.provided ?? [];
        case "polled":
            return zipPolledCwds(paneIds, options.polled ?? new Map());
        case "fresh": {
            const infos = await freshPaneInfo(paneIds);
            return zipFreshCwds(paneIds, infos);
        }
    }
}

/** One tab's chrome for Session persistence (no CWDs — ADR 0001). */
export interface SessionTabChrome {
    readonly layout: SerializedNode;
    readonly name?: string;
    readonly dotColor?: TabDotColor;
}

/** Build SessionData from live tab chrome; null when nothing to persist. */
export function buildSessionData(tabs: readonly SessionTabChrome[], activeTab: number): SessionData | null {
    if (tabs.length === 0) {
        return null;
    }
    const sessionTabs: SessionTab[] = tabs.map((tab) => ({
        layout: tab.layout,
        ...(tab.name !== undefined ? { name: tab.name } : {}),
        ...(tab.dotColor !== undefined ? { dotColor: tab.dotColor } : {}),
    }));
    return {
        version: SESSION_VERSION,
        activeTab: Math.min(Math.max(activeTab, 0), sessionTabs.length - 1),
        tabs: sessionTabs,
    };
}

/** Assemble a Closed tab snapshot once CWDs are already resolved. */
export function buildClosedTabSnapshot(input: {
    layout: SerializedNode;
    name: string | null;
    dotColor: TabDotColor | null;
    cwds: readonly (string | null)[];
}): ClosedTabSnapshot {
    return {
        layout: input.layout,
        name: input.name,
        dotColor: input.dotColor,
        cwds: input.cwds,
    };
}

/** Live Layout + fresh CWDs for save-as-preset (FR-012). */
export async function capturePresetLayout(
    paneIds: readonly number[],
    layout: SerializedNode,
): Promise<{ layout: SerializedNode; cwds: readonly (string | null)[] }> {
    const cwds = await resolvePaneCwds(paneIds, "fresh");
    return { layout, cwds };
}

/**
 * Whether materializing this Tab should open the one-shot Agent picker.
 * Session restore and Open board / Layout preset: yes.
 * Closed tab reopen and plain new Tab: no (picker already ran or N/A).
 */
export type AgentPickScope = "all-new-panes" | "none";

export interface MaterializeIntent {
    readonly layout: SerializedNode | null;
    readonly cwds: readonly (string | null)[];
    readonly agentPick: AgentPickScope;
}
