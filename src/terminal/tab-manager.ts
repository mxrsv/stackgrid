import { homeDir } from "@tauri-apps/api/path";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  clampFontSize,
  DEFAULT_SETTINGS,
  type Settings,
} from "../settings/settings-schema";
import { settings, updateSettings } from "../settings/settings-store";
import type { Direction, SerializedNode } from "../lib/split-tree";
import { isAgent } from "../lib/process-info";
import { matchBinding, selectTabIndex } from "./keymap";
import { loadSession, scheduleSessionSave } from "./session-persistence";
import { installFileDrop } from "./file-drop";
import {
  createTerminalManager,
  type TerminalManager,
  type TerminalManagerDeps,
} from "./terminal-manager";
import { createPaneInfoPoller } from "./pane-info-poller";
import {
  popClosedTab,
  pushClosedTab,
  type ClosedTabSnapshot,
} from "./closed-tabs";
import { confirmClose } from "./close-guard";
import { createCloseCoordinator } from "./close-coordinator";
import { activeAfterClose } from "./tab-close";
import { freshCwd } from "./pane-info";
import { defaultPtyClient, type PtyClient } from "./pty-client";
import {
  buildClosedTabSnapshot,
  buildSessionData,
  capturePresetLayout,
  materializeChromeFrom,
  resolvePaneCwds,
  materializeAfterSpawn,
  type MaterializeIntent,
} from "./tab-materialize";
import {
  activeTabIndex,
  applyTabOverride,
  statusInfo,
  tabViews,
  type TabOverride,
} from "./tabs-store";
import type { TabDotColor } from "../lib/tab-colors";
import { beginAgentPick } from "../agent-picker/agent-picker";
import { prunePending } from "../agent-picker/picker-store";
import { boardOpen, saveDialogOpen } from "../chrome/events";

interface TabEntry {
  readonly key: number;
  readonly manager: TerminalManager;
}

/** Owns all tabs: routing, keyboard, persistence; info polling lives in PaneInfoPoller. */
export interface TabManager {
  /** Init listeners + optional session restore; hasTabs=false → show the Open board. */
  init(): Promise<{ hasTabs: boolean }>;
  /** Materialize one tab from a MaterializeIntent (Open / Session / Closed / preset). */
  materialize(intent: MaterializeIntent): Promise<boolean>;
  /** Materialize one tab from a preset layout + resolved CWDs; begins agent pick. */
  openFromPreset(
    layout: SerializedNode,
    cwds: readonly (string | null)[],
  ): Promise<boolean>;
  /** Live layout + fresh per-pane CWDs for save-as-preset; null when no tab. */
  captureActiveLayout(): Promise<{
    layout: SerializedNode;
    cwds: readonly (string | null)[];
  } | null>;
  /** Fresh CWD of the focused pane (editor "↑ inherit" from a live window). */
  activePaneCwd(): Promise<string | null>;
  /** Overlay anchor for a pane in any tab (agent picker cards). */
  paneOverlayHost(id: number): HTMLElement | null;
  newTab(): Promise<void>;
  /** Close a tab after the busy guard; every pane's process is checked. */
  closeTab(index: number): Promise<void>;
  selectTab(index: number): void;
  /** Set or clear (null) a custom tab name; overrides the process label. */
  renameTab(index: number, name: string | null): void;
  /** Set or clear (null) a custom tab dot color token. */
  setTabDotColor(index: number, color: TabDotColor | null): void;
  cycleTab(step: 1 | -1): void;
  splitActive(dir: Direction): Promise<void>;
  /** Close the focused pane (busy-guarded); last pane in tab closes the tab. */
  closePane(): Promise<void>;
  applySettings(next: Settings): void;
  focusActive(): void;
  dispose(): void;
}

export function createTabManager(
  host: HTMLElement,
  pty: PtyClient = defaultPtyClient,
  deps: TerminalManagerDeps = {},
): TabManager {
  const tabs: TabEntry[] = [];
  const unlisteners: UnlistenFn[] = [];
  // Per-tab user overrides (rename, dot color), keyed by tab key —
  // merged over process-derived values on every syncViews.
  const overrides = new Map<number, TabOverride>();
  // Recently closed tabs (Cmd+Shift+T), newest last; in-memory only.
  let closedTabs: readonly ClosedTabSnapshot[] = [];
  let nextKey = 1;
  let active = -1;
  let home = "";
  // dispose() can run while init()'s `await listen(...)` is still in flight
  // (e.g. a remount mid-init) — guards against pushing a listener into an
  // `unlisteners` array that's already been drained, which would leak it.
  let disposed = false;

  function activeManager(): TerminalManager | null {
    return active >= 0 && active < tabs.length ? tabs[active].manager : null;
  }

  function sessionChrome() {
    const chrome = [];
    for (const tab of tabs) {
      const layout = tab.manager.serializeLayout();
      if (layout === null) {
        continue;
      }
      const override = overrides.get(tab.key);
      chrome.push({
        layout,
        ...(override?.name !== undefined ? { name: override.name } : {}),
        ...(override?.dotColor !== undefined
          ? { dotColor: override.dotColor }
          : {}),
      });
    }
    return buildSessionData(chrome, active);
  }

  function persist(): void {
    scheduleSessionSave(sessionChrome);
  }

  function syncViews(): void {
    tabViews.value = tabs.map((tab) => {
      const paneId = tab.manager.activePaneId();
      const info = paneId === null ? undefined : poller.infoFor(paneId);
      return applyTabOverride(
        {
          key: tab.key,
          process: info?.process ?? null,
          name: null,
          dotColor: null,
        },
        overrides.get(tab.key),
      );
    });
    activeTabIndex.value = active;
    const manager = activeManager();
    const paneId = manager?.activePaneId() ?? null;
    const info = paneId === null ? undefined : poller.infoFor(paneId);
    const process = info?.process ?? null;
    statusInfo.value = {
      branch: poller.branch(),
      cwd: info?.cwd ?? null,
      agent: isAgent(process) ? process : null,
      paneCount: manager?.paneCount() ?? 0,
      home,
    };
  }

  function allPaneIds(): number[] {
    return tabs.flatMap((tab) => tab.manager.paneIds());
  }

  const callbacks = {
    onLayoutChange(): void {
      syncViews();
      persist();
      prunePending(allPaneIds());
    },
  };

  /** Create + init a tab; false (and an error note) when spawning fails. */
  async function addTab(
    layout: SerializedNode | null,
    cwds: readonly (string | null)[] = [],
  ): Promise<boolean> {
    const container = document.createElement("div");
    container.className = "tab-stage";
    container.style.display = "none";
    host.appendChild(container);
    const manager = createTerminalManager(container, callbacks, pty, deps);
    try {
      if (layout === null) {
        await manager.initFresh(cwds[0] ?? null);
      } else {
        await manager.initFromLayout(layout, cwds);
      }
    } catch (err) {
      console.error("Failed to open tab:", err);
      manager.dispose();
      activeManager()?.notifyError(`Failed to open new tab: ${err}`);
      return false;
    }
    tabs.push({ key: nextKey, manager });
    nextKey += 1;
    return true;
  }

  function selectTab(index: number): void {
    if (index < 0 || index >= tabs.length || index === active) {
      return;
    }
    activeManager()?.hide();
    active = index;
    tabs[index].manager.show();
    syncViews();
    persist();
  }

  function setOverride(index: number, patch: TabOverride): void {
    const entry = tabs[index];
    if (!entry) {
      return;
    }
    const next = { ...(overrides.get(entry.key) ?? {}), ...patch };
    if (next.name === undefined && next.dotColor === undefined) {
      overrides.delete(entry.key);
    } else {
      overrides.set(entry.key, next);
    }
    syncViews();
    persist();
  }

  async function newTab(): Promise<void> {
    // New tab goes through the Open board (workspace ∥ preset), same as cold start.
    boardOpen.value = true;
  }

  /**
   * Deep Materialize entry: spawn + optional chrome + activate/agent-pick policy.
   * Open board / Layout preset / Closed tab / Session (per-tab) all go here.
   */
  async function materialize(intent: MaterializeIntent): Promise<boolean> {
    if (!(await addTab(intent.layout, intent.cwds))) {
      return false;
    }
    const key = tabs[tabs.length - 1].key;
    const chrome = intent.chrome;
    if (chrome !== undefined) {
      const override: TabOverride = {
        ...(chrome.name !== undefined ? { name: chrome.name } : {}),
        ...(chrome.dotColor !== undefined ? { dotColor: chrome.dotColor } : {}),
      };
      if (override.name !== undefined || override.dotColor !== undefined) {
        overrides.set(key, override);
      }
    }
    const activate = materializeAfterSpawn(intent);
    if (!activate.selectTab) {
      return true;
    }
    selectTab(tabs.length - 1);
    if (activate.pollAndAgentPick) {
      void poller.poll();
      void beginAgentPick(tabs[tabs.length - 1].manager.paneIds(), pty);
    }
    return true;
  }

  /** FR-005: one tab per Open; CWDs already resolved by the caller. */
  function openFromPreset(
    layout: SerializedNode,
    cwds: readonly (string | null)[],
  ): Promise<boolean> {
    return materialize({
      layout,
      cwds,
      agentPick: "all-new-panes",
    });
  }

  /** FR-012: fresh CWDs via TabMaterialize so a just-cd'd pane saves correctly. */
  async function captureActiveLayout(): Promise<{
    layout: SerializedNode;
    cwds: readonly (string | null)[];
  } | null> {
    const manager = activeManager();
    const layout = manager?.serializeLayout() ?? null;
    if (!manager || layout === null) {
      return null;
    }
    return capturePresetLayout(manager.paneIds(), layout, pty);
  }

  function activePaneCwd(): Promise<string | null> {
    return freshCwd(activeManager()?.activePaneId() ?? null, pty);
  }

  function paneOverlayHost(id: number): HTMLElement | null {
    for (const tab of tabs) {
      const element = tab.manager.paneElement(id);
      if (element !== null) {
        return element;
      }
    }
    return null;
  }

  async function reopenTab(): Promise<void> {
    const [snapshot, rest] = popClosedTab(closedTabs);
    if (snapshot === null) {
      return;
    }
    if (
      !(await materialize({
        layout: snapshot.layout,
        cwds: snapshot.cwds,
        agentPick: "none",
        chrome: materializeChromeFrom(snapshot.name, snapshot.dotColor),
      }))
    ) {
      return; // spawn failed — keep the snapshot for another attempt
    }
    closedTabs = rest;
  }

  /** Unguarded dispose — Busy already confirmed by CloseCoordinator. */
  async function disposeTab(index: number): Promise<void> {
    const entry = tabs[index];
    if (!entry) {
      return;
    }
    // Snapshot BEFORE dispose — fresh CWDs (same policy as Layout preset).
    // The fresh pty_info is an IPC await, so resolve it before touching any
    // tab state; the positional index can go stale across it (rapid Cmd+W).
    const layout = entry.manager.serializeLayout();
    if (layout !== null) {
      const override = overrides.get(entry.key);
      const cwds = await resolvePaneCwds(entry.manager.paneIds(), "fresh", {
        pty,
      });
      closedTabs = pushClosedTab(
        closedTabs,
        buildClosedTabSnapshot({
          layout,
          name: override?.name ?? null,
          dotColor: override?.dotColor ?? null,
          cwds,
        }),
      );
    }
    // Re-derive position from the captured entry: a concurrent close during
    // the await above may have removed/shifted it. -1 → already disposed.
    const removeAt = tabs.indexOf(entry);
    if (removeAt === -1) {
      return;
    }
    const closingActive = removeAt === active;
    const countBefore = tabs.length;
    entry.manager.dispose();
    tabs.splice(removeAt, 1);
    overrides.delete(entry.key);
    prunePending(allPaneIds());
    if (tabs.length === 0) {
      // Closing the last tab quits the app (ADR 0002). CloseCoordinator
      // already ran the busy guard, so exit directly — no second dialog.
      active = -1;
      await pty.confirmQuit();
      return;
    }
    active = activeAfterClose(removeAt, active, countBefore);
    if (closingActive) {
      tabs[active].manager.show();
    }
    syncViews();
    persist();
  }

  const close = createCloseCoordinator({
    confirmClose: (paneIds) => confirmClose(paneIds, pty),
    activeManager,
    activeIndex: () => active,
    tabAt: (index) => tabs[index],
    indexOf: (entry) => tabs.findIndex((tab) => tab.manager === entry.manager),
    disposeTab,
  });

  /** Active pane of every tab (tab dots) + all panes of the active tab (headers). */
  function pollTargets(): number[] {
    const ids = new Set<number>();
    for (const tab of tabs) {
      const paneId = tab.manager.activePaneId();
      if (paneId !== null) {
        ids.add(paneId);
      }
    }
    for (const id of activeManager()?.paneIds() ?? []) {
      ids.add(id);
    }
    return [...ids];
  }

  const poller = createPaneInfoPoller({
    pty,
    targets: pollTargets,
    activePaneId: () => activeManager()?.activePaneId() ?? null,
    onUpdate(infos) {
      activeManager()?.updatePaneInfo(infos, home);
      syncViews();
    },
  });

  function cycleTab(step: 1 | -1): void {
    if (tabs.length < 2) {
      return;
    }
    selectTab((active + step + tabs.length) % tabs.length);
  }

  function handleShortcut(event: KeyboardEvent): void {
    // Never intercept keys the IME is still composing — keyCode 229 catches
    // WebKit events that arrive without isComposing (Vietnamese/CJK input).
    if (event.isComposing || event.keyCode === 229) {
      return;
    }
    // Never fire shortcuts while typing in a text field (same approach as
    // the IME guard above) — e.g. the tab rename input in the popover.
    if (
      (event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement) &&
      !(event.target as HTMLElement).closest(".pane__term")
    ) {
      return;
    }
    const action = matchBinding(event);
    if (action === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const tabIndex = selectTabIndex(action);
    if (tabIndex !== null) {
      selectTab(tabIndex); // out-of-range indexes are a no-op
      return;
    }
    switch (action) {
      case "split-row":
        void splitActive("row");
        break;
      case "split-column":
        void splitActive("column");
        break;
      case "close-pane":
        void close.closePane();
        break;
      case "focus-next":
        activeManager()?.cycleFocus(1);
        break;
      case "focus-prev":
        activeManager()?.cycleFocus(-1);
        break;
      case "toggle-expand":
        updateSettings({ focusExpand: !settings.value.focusExpand });
        break;
      case "new-tab":
        void newTab();
        break;
      case "close-tab":
        void close.closeTab(active);
        break;
      case "next-tab":
        cycleTab(1);
        break;
      case "prev-tab":
        cycleTab(-1);
        break;
      case "zoom-in":
        updateSettings({
          fontSize: clampFontSize(settings.value.fontSize + 1),
        });
        break;
      case "zoom-out":
        updateSettings({
          fontSize: clampFontSize(settings.value.fontSize - 1),
        });
        break;
      case "zoom-reset":
        updateSettings({ fontSize: DEFAULT_SETTINGS.fontSize });
        break;
      case "toggle-zoom-pane":
        activeManager()?.toggleZoom();
        break;
      case "clear-buffer":
        activeManager()?.clearActive();
        break;
      case "focus-left":
        activeManager()?.focusDirection("left");
        break;
      case "focus-right":
        activeManager()?.focusDirection("right");
        break;
      case "focus-up":
        activeManager()?.focusDirection("up");
        break;
      case "focus-down":
        activeManager()?.focusDirection("down");
        break;
      case "reopen-tab":
        void reopenTab();
        break;
      case "find":
        activeManager()?.openSearch();
        break;
      case "save-preset":
        if (tabs.length > 0 && !boardOpen.value) {
          saveDialogOpen.value = true;
        }
        break;
    }
  }

  function splitActive(dir: Direction): Promise<void> {
    return activeManager()?.splitActive(dir) ?? Promise.resolve();
  }

  // `dispose()` can run while this await is still in flight (a remount mid-
  // init). Pushing into `unlisteners` after that would leak a live listener
  // that keeps feeding a `tabs` array nobody drains anymore — for
  // EVENT_OUTPUT specifically, that means every remount adds one more
  // listener still writing the same PTY bytes into xterm, so terminal
  // content visibly repeats. Route registration through this guard instead.
  async function registerUnlisten(pending: Promise<UnlistenFn>): Promise<void> {
    const unlisten = await pending;
    if (disposed) {
      unlisten();
      return;
    }
    unlisteners.push(unlisten);
  }

  async function init(): Promise<{ hasTabs: boolean }> {
    await registerUnlisten(
      pty.listenOutput((id, data) => {
        for (const tab of tabs) {
          tab.manager.handleOutput(id, data);
        }
      }),
    );
    await registerUnlisten(
      pty.listenExit((id) => {
        for (const tab of tabs) {
          tab.manager.handleExit(id);
        }
      }),
    );
    await registerUnlisten(
      installFileDrop({
        onOver(x, y) {
          activeManager()?.fileDragOver(x, y);
        },
        onDrop(x, y, paths) {
          activeManager()?.fileDrop(x, y, paths);
        },
        onLeave() {
          activeManager()?.fileDragLeave();
        },
      }),
    );
    window.addEventListener("keydown", handleShortcut, true);
    try {
      home = await homeDir();
    } catch {
      home = "";
    }

    const session = settings.value.restoreTabs ? await loadSession() : null;
    if (session !== null) {
      for (const sessionTab of session.tabs) {
        /** Session restore: layout only — CWDs are `none` (spawn at `$HOME`). */
        if (
          !(await materialize({
            layout: sessionTab.layout,
            cwds: [],
            agentPick: "none",
            activate: false,
            chrome: materializeChromeFrom(sessionTab.name, sessionTab.dotColor),
          }))
        ) {
          continue; // spawn failed — skip its overrides too
        }
      }
    }
    poller.start();
    if (tabs.length === 0) {
      // No restorable session — the App shows the Open board (FR-001)
      syncViews();
      return { hasTabs: false };
    }
    selectTab(
      session === null ? 0 : Math.min(session.activeTab, tabs.length - 1),
    );
    void poller.poll();
    // Restore never skips the one-shot picker (FR-021 AC-3)
    void beginAgentPick(allPaneIds(), pty);
    return { hasTabs: true };
  }

  return {
    init,
    materialize,
    openFromPreset,
    captureActiveLayout,
    activePaneCwd,
    paneOverlayHost,
    newTab,
    closeTab: (index) => close.closeTab(index),
    selectTab,
    renameTab(index, name) {
      const trimmed = name?.trim() ?? "";
      setOverride(index, { name: trimmed === "" ? undefined : trimmed });
    },
    setTabDotColor(index, color) {
      setOverride(index, { dotColor: color ?? undefined });
    },
    cycleTab,
    splitActive,
    closePane: () => close.closePane(),
    applySettings(next) {
      for (const tab of tabs) {
        tab.manager.applySettings(next);
      }
    },
    focusActive() {
      activeManager()?.focusActive();
    },
    dispose() {
      disposed = true;
      poller.stop();
      window.removeEventListener("keydown", handleShortcut, true);
      for (const unlisten of unlisteners) {
        unlisten();
      }
      for (const tab of tabs) {
        tab.manager.dispose();
      }
      tabs.length = 0;
    },
  };
}
