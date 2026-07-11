import type { PaneProcessInfo } from "../lib/process-info";
import { SESSION_VERSION, type SessionData, type SessionTab } from "../lib/session-schema";
import { countLeaves, type SerializedNode } from "../lib/split-tree";
import type { TabDotColor } from "../lib/tab-colors";
import { freshPaneInfo } from "./pane-info";
import { defaultPtyClient, type PtyClient } from "./pty-client";
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
        pty?: PtyClient;
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
            const infos = await freshPaneInfo(
                paneIds,
                options.pty ?? defaultPtyClient,
            );
            return zipFreshCwds(paneIds, infos);
        }
    }
}

/**
 * Layout preset editor (live window): each leaf uses its preset CWD when set,
 * otherwise inherits the focused pane's CWD (BF-Rule 8).
 */
export function resolveInheritedCwds(
    layout: SerializedNode,
    presetCwds: readonly (string | null)[] | undefined,
    inherit: string | null,
): readonly (string | null)[] {
    return Array.from(
        { length: countLeaves(layout) },
        (_, index) => presetCwds?.[index] ?? inherit,
    );
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
    pty: PtyClient = defaultPtyClient,
): Promise<{ layout: SerializedNode; cwds: readonly (string | null)[] }> {
    const cwds = await resolvePaneCwds(paneIds, "fresh", { pty });
    return { layout, cwds };
}

/**
 * Whether materializing this Tab should open the one-shot Agent picker.
 * Session restore and Open board / Layout preset: yes (batch or per-tab).
 * Closed tab reopen: no (picker already ran).
 */
export type AgentPickScope = "all-new-panes" | "none";

/** Optional tab chrome applied under the new tab key after spawn. */
export interface MaterializeChrome {
    readonly name?: string;
    readonly dotColor?: TabDotColor;
}

/**
 * Single interface for Open board / Session / Closed tab / Layout preset.
 * TabManager.materialize owns the implementation.
 */
export interface MaterializeIntent {
    readonly layout: SerializedNode | null;
    readonly cwds: readonly (string | null)[];
    readonly agentPick: AgentPickScope;
    readonly chrome?: MaterializeChrome;
    /**
     * Select the new tab after spawn. Default true.
     * Session restore batches with activate:false, then selects once.
     */
    readonly activate?: boolean;
}

/**
 * Pure post-spawn policy for Materialize — tested without TabManager/DOM.
 * Open board / preset: activate + pollAndAgentPick.
 * Closed tab reopen: activate only.
 * Session batch: neither (caller selects + picks once at the end).
 */
export function materializeAfterSpawn(intent: MaterializeIntent): {
    selectTab: boolean;
    pollAndAgentPick: boolean;
} {
    const selectTab = intent.activate !== false;
    return {
        selectTab,
        pollAndAgentPick: selectTab && intent.agentPick === "all-new-panes",
    };
}

/** Build chrome overrides from a Closed tab snapshot or Session tab. */
export function materializeChromeFrom(
    name: string | null | undefined,
    dotColor: TabDotColor | null | undefined,
): MaterializeChrome | undefined {
    const chrome: MaterializeChrome = {
        ...(name != null ? { name } : {}),
        ...(dotColor != null ? { dotColor } : {}),
    };
    if (chrome.name === undefined && chrome.dotColor === undefined) {
        return undefined;
    }
    return chrome;
}
