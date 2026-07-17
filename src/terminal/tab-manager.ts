import { homeDir } from "@tauri-apps/api/path";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  clampFontSize,
  DEFAULT_SETTINGS,
  type Settings,
} from "../settings/settings-schema";
import {
  flushSettingsSave,
  settings,
  updateSettings,
} from "../settings/settings-store";
import { type Direction, type SerializedNode } from "../lib/split-tree";
import { isAgent } from "../lib/process-info";
import { normalizeWorkspacePath } from "../lib/workspace-label";
import type { AgentChoice } from "../lib/workspace-recents";
import { matchBinding, selectTabIndex, type ShortcutAction } from "./keymap";
import { installFileDrop } from "./file-drop";
import {
  createTerminalManager,
  type TerminalManager,
  type TerminalManagerDeps,
} from "./terminal-manager";
import { createPaneInfoPoller } from "./pane-info-poller";
import { createAgentActivity } from "./agent-activity";
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
import { createAgentLauncher } from "./agent-launch";
import {
  buildClosedTabSnapshot,
  capturePresetLayout,
  materializeChromeFrom,
  resolvePaneCwds,
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
import { boardOpen, saveDialogOpen } from "../chrome/events";

interface TabEntry {
  readonly key: number;
  readonly manager: TerminalManager;
  /**
   * Workspace ≡ Tab: the directory picked on Open, fixed for the tab's life.
   * Never re-derived from a pane's live CWD (a `cd` must not rename the tab).
   */
  readonly workspacePath: string | null;
}

/** Options for materializing one tab from a preset layout. */
export interface OpenFromPresetOptions {
  readonly workspacePath?: string;
  /** Agent CLI to launch in every new pane; `null`/absent = Shell only. */
  readonly agent?: AgentChoice;
}

/** Owns all tabs: routing, keyboard, agent launch; info polling lives in PaneInfoPoller. */
export interface TabManager {
  /** Install listeners + start polling. The app always opens on the board. */
  init(): Promise<void>;
  /** Materialize one tab from a MaterializeIntent (Open / Closed / preset). */
  materialize(intent: MaterializeIntent): Promise<boolean>;
  /** Materialize one tab from a preset layout + resolved CWDs; launches the agent. */
  openFromPreset(
    layout: SerializedNode,
    cwds: readonly (string | null)[],
    options?: OpenFromPresetOptions,
  ): Promise<boolean>;
  /** Index of the tab owning `path`, or -1 — Open dedupes against this. */
  findTabByWorkspace(path: string): number;
  /** Workspace of the active tab; null when it has none (or no tab). */
  activeWorkspacePath(): string | null;
  /** Live layout + fresh per-pane CWDs for save-as-preset; null when no tab. */
  captureActiveLayout(): Promise<{
    layout: SerializedNode;
    cwds: readonly (string | null)[];
  } | null>;
  /** Fresh CWD of the focused pane (editor "↑ inherit" from a live window). */
  activePaneCwd(): Promise<string | null>;
  newTab(): Promise<void>;
  /** Reopen the most recently closed tab (⌘⇧T); skips dead workspaces. */
  reopenTab(): Promise<void>;
  /** Close a tab after the busy guard; every pane's process is checked. */
  closeTab(index: number): Promise<void>;
  selectTab(index: number): void;
  /** Set or clear (null) a custom tab name; overrides the process label. */
  renameTab(index: number, name: string | null): void;
  /** Set or clear (null) a custom tab dot color token. */
  setTabDotColor(index: number, color: TabDotColor | null): void;
  cycleTab(step: 1 | -1): void;
  splitActive(dir: Direction): Promise<void>;
  /** Every pane id across every tab (quit-path busy guard). */
  allPaneIds(): number[];
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
  // Tabs with output arrived while in the background, keyed by tab key.
  // In-memory only (like busy) — a background pane's output lights the badge,
  // opening the tab clears it.
  const unread = new Set<number>();
  // Per-pane "actually working" signal (OSC 9;4 progress reports from the
  // agent, else sustained non-echo output) — gates the sidebar spinner so an
  // agent sitting idle at its prompt doesn't spin forever.
  const activity = createAgentActivity();
  // Working→idle can expire with no event attached (3s of silence). The 2s
  // poll usually resyncs, but a one-shot timer per pane makes the transition
  // self-sufficient even if pty_info is failing — keyed by pane so a chatty
  // neighbor pane can't keep pushing another pane's expiry away.
  const activityResync = new Map<number, ReturnType<typeof setTimeout>>();
  // Panes write user input through this wrapper so the tracker can tell
  // keystroke echo from real output; everything else passes straight through.
  const paneIo: PtyClient = {
    ...pty,
    writePty(id, data) {
      activity.noteInput(id);
      return pty.writePty(id, data);
    },
  };
  // Recently closed tabs (Cmd+Shift+T), newest last; in-memory only.
  let closedTabs: readonly ClosedTabSnapshot[] = [];
  let nextKey = 1;
  let active = -1;
  let home = "";
  // dispose() can run while init()'s `await listen(...)` is still in flight
  // (e.g. a remount mid-init) — guards against pushing a listener into an
  // `unlisteners` array that's already been drained, which would leak it.
  let disposed = false;
  // Types the chosen agent into each new pane's shell once its prompt is up.
  // Through paneIo so its synthetic keystrokes ("claude\r") count as input —
  // the echo suppression then keeps the launch echo out of the spinner.
  const launcher = createAgentLauncher(paneIo);

  function activeManager(): TerminalManager | null {
    return active >= 0 && active < tabs.length ? tabs[active].manager : null;
  }

  /** Index of the tab owning `path` (normalized both sides), or -1. */
  function findWorkspaceIndex(path: string): number {
    const target = normalizeWorkspacePath(path);
    if (target === null) {
      return -1;
    }
    return tabs.findIndex((tab) => tab.workspacePath === target);
  }

  function syncViews(): void {
    tabViews.value = tabs.map((tab) => {
      const paneId = tab.manager.activePaneId();
      const info = paneId === null ? undefined : poller.infoFor(paneId);
      // The spinner means "an agent is WORKING somewhere in this tab" — every
      // pane counts, not just the focused one (a background pane running
      // `claude` is exactly the case the sidebar exists for). An agent idle
      // at its prompt does not count: activity tracks OSC 9;4 progress
      // reports (with a sustained-output fallback) to tell the two apart.
      const paneIds = tab.manager.paneIds();
      for (const id of paneIds) {
        // A process change (agent exited to the shell, new agent started)
        // invalidates whatever the old program reported.
        activity.noteProcess(id, poller.infoFor(id)?.process ?? null);
      }
      const agentBusy = paneIds.some(
        (id) =>
          isAgent(poller.infoFor(id)?.process ?? null) && activity.working(id),
      );
      return applyTabOverride(
        {
          key: tab.key,
          process: info?.process ?? null,
          name: null,
          dotColor: null,
          workspacePath: tab.workspacePath,
          agentBusy,
          unread: unread.has(tab.key),
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
      const live = allPaneIds();
      launcher.prune(live);
      activity.prune(live);
      // Every pane of every tab is polled now, so a long session would
      // otherwise leave one cache entry behind per pane ever opened.
      poller.prune(live);
    },
  };

  /** Create + init a tab; false (and an error note) when spawning fails. */
  async function addTab(
    layout: SerializedNode | null,
    cwds: readonly (string | null)[] = [],
    workspacePath: string | null = null,
  ): Promise<boolean> {
    const container = document.createElement("div");
    container.className = "tab-stage";
    container.style.display = "none";
    host.appendChild(container);
    const manager = createTerminalManager(container, callbacks, paneIo, deps);
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
    tabs.push({
      key: nextKey,
      manager,
      // The only place a tab's workspace is ever set — normalize here so every
      // entry point (Open, reopen, live preset) agrees on one spelling.
      workspacePath:
        workspacePath === null ? null : normalizeWorkspacePath(workspacePath),
    });
    nextKey += 1;
    return true;
  }

  function selectTab(index: number): void {
    if (index < 0 || index >= tabs.length || index === active) {
      return;
    }
    activeManager()?.hide();
    active = index;
    unread.delete(tabs[index].key); // opening the tab clears its unread badge
    tabs[index].manager.show();
    syncViews();
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
  }

  async function newTab(): Promise<void> {
    // New tab goes through the Open board (workspace ∥ preset ∥ agent).
    boardOpen.value = true;
  }

  /**
   * Deep Materialize entry: spawn + optional chrome + select + agent launch.
   * Open board / Layout preset / Closed tab all go here.
   */
  async function materialize(intent: MaterializeIntent): Promise<boolean> {
    // Workspace ≡ Tab (1:1): a workspace that already has a tab is never opened
    // a second time — focus the existing tab instead. This enforces the
    // invariant at the one choke point every entry uses (Open board, New preset
    // from a live window, Cmd+Shift+T reopen), not just in the Open handler.
    if (intent.workspacePath !== undefined) {
      const existing = findWorkspaceIndex(intent.workspacePath);
      if (existing !== -1) {
        selectTab(existing);
        return true;
      }
    }
    if (
      !(await addTab(intent.layout, intent.cwds, intent.workspacePath ?? null))
    ) {
      return false;
    }
    const entry = tabs[tabs.length - 1];
    const chrome = intent.chrome;
    if (chrome !== undefined) {
      const override: TabOverride = {
        ...(chrome.name !== undefined ? { name: chrome.name } : {}),
        ...(chrome.dotColor !== undefined ? { dotColor: chrome.dotColor } : {}),
      };
      if (override.name !== undefined || override.dotColor !== undefined) {
        overrides.set(entry.key, override);
      }
    }
    selectTab(tabs.length - 1);
    void poller.poll();
    // Each pane types its agent once its shell prints the first byte; `null`
    // (Shell only / reopen) arms nothing.
    launcher.arm(entry.manager.paneIds(), intent.agent ?? null);
    return true;
  }

  /** FR-005: one tab per Open; CWDs already resolved by the caller. */
  function openFromPreset(
    layout: SerializedNode,
    cwds: readonly (string | null)[],
    options: OpenFromPresetOptions = {},
  ): Promise<boolean> {
    return materialize({
      layout,
      cwds,
      ...(options.workspacePath !== undefined
        ? { workspacePath: options.workspacePath }
        : {}),
      ...(options.agent !== undefined ? { agent: options.agent } : {}),
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

  /** A tab with no workspace is always live; an unanswerable check fails open. */
  async function workspaceIsLive(path: string | null): Promise<boolean> {
    if (path === null) {
      return true;
    }
    try {
      const [exists] = await pty.dirsExist([path]);
      return exists !== false;
    } catch (err) {
      console.warn("dirs_exist failed; reopening the tab anyway:", err);
      return true;
    }
  }

  /**
   * Cmd+Shift+T. The folder can be deleted between closing the tab and
   * reopening it (the snapshot survives up to MAX_CLOSED_TABS closes), and
   * spawning at a dead CWD silently lands in `$HOME` while the tab keeps
   * claiming the folder. Dead snapshots are discarded and the next one down
   * the stack is tried instead. Reopen does NOT re-run the agent (agent: null).
   */
  async function reopenTab(): Promise<void> {
    let stack = closedTabs;
    for (;;) {
      const [snapshot, rest] = popClosedTab(stack);
      if (snapshot === null) {
        closedTabs = stack;
        return;
      }
      if (!(await workspaceIsLive(snapshot.workspacePath))) {
        console.warn(
          `Not reopening tab: workspace ${snapshot.workspacePath} no longer exists`,
        );
        stack = rest; // drop the dead snapshot, try the one below it
        continue;
      }
      if (
        !(await materialize({
          layout: snapshot.layout,
          cwds: snapshot.cwds,
          chrome: materializeChromeFrom(snapshot.name, snapshot.dotColor),
          ...(snapshot.workspacePath !== null
            ? { workspacePath: snapshot.workspacePath }
            : {}),
        }))
      ) {
        closedTabs = stack; // spawn failed — keep the snapshot for another try
        return;
      }
      closedTabs = rest;
      return;
    }
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
          workspacePath: entry.workspacePath,
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
    unread.delete(entry.key);
    const live = allPaneIds();
    launcher.prune(live);
    activity.prune(live);
    poller.prune(live);
    if (tabs.length === 0) {
      // Closing the last tab quits the app (ADR 0002). CloseCoordinator
      // already ran the busy guard, so exit directly — no second dialog.
      active = -1;
      try {
        await flushSettingsSave();
      } catch (err: unknown) {
        console.warn("Flush before quit failed:", err);
      }
      await pty.confirmQuit();
      return;
    }
    active = activeAfterClose(removeAt, active, countBefore);
    if (closingActive) {
      tabs[active].manager.show();
    }
    syncViews();
  }

  const close = createCloseCoordinator({
    confirmClose: (paneIds) => confirmClose(paneIds, pty),
    activeManager,
    activeIndex: () => active,
    tabAt: (index) => tabs[index],
    indexOf: (entry) => tabs.findIndex((tab) => tab.manager === entry.manager),
    disposeTab,
  });

  /**
   * Every pane of every tab: the workspace dot must see an agent running in a
   * background pane of a background tab, so polling only the active panes is
   * no longer enough. One `pty_info` IPC takes the whole id list.
   */
  function pollTargets(): number[] {
    return allPaneIds();
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

  // Keymap *matching* lives in keymap.ts; this table is the dispatch half —
  // one action, one closure. `select-tab-N` is handled via selectTabIndex.
  const commands: Partial<Record<ShortcutAction, () => void>> = {
    "split-row": () => void splitActive("row"),
    "split-column": () => void splitActive("column"),
    "close-pane": () => void close.closePane(),
    "focus-next": () => activeManager()?.cycleFocus(1),
    "focus-prev": () => activeManager()?.cycleFocus(-1),
    "toggle-expand": () =>
      updateSettings({ focusExpand: !settings.value.focusExpand }),
    "new-tab": () => void newTab(),
    "close-tab": () => void close.closeTab(active),
    "next-tab": () => cycleTab(1),
    "prev-tab": () => cycleTab(-1),
    "zoom-in": () =>
      updateSettings({ fontSize: clampFontSize(settings.value.fontSize + 1) }),
    "zoom-out": () =>
      updateSettings({ fontSize: clampFontSize(settings.value.fontSize - 1) }),
    "zoom-reset": () => updateSettings({ fontSize: DEFAULT_SETTINGS.fontSize }),
    "toggle-zoom-pane": () => activeManager()?.toggleZoom(),
    "clear-buffer": () => activeManager()?.clearActive(),
    "focus-left": () => activeManager()?.focusDirection("left"),
    "focus-right": () => activeManager()?.focusDirection("right"),
    "focus-up": () => activeManager()?.focusDirection("up"),
    "focus-down": () => activeManager()?.focusDirection("down"),
    "reopen-tab": () => void reopenTab(),
    find: () => activeManager()?.openSearch(),
    "save-preset": () => {
      if (tabs.length > 0 && !boardOpen.value) {
        saveDialogOpen.value = true;
      }
    },
  };

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
    commands[action]?.();
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

  async function init(): Promise<void> {
    await registerUnlisten(
      pty.listenOutput((id, data) => {
        // The launcher waits for a pane's first byte before typing its agent;
        // route every chunk to it before fanning out to the tabs.
        launcher.noteOutput(id);
        const workingChanged = activity.noteOutput(id, data);
        for (const tab of tabs) {
          tab.manager.handleOutput(id, data);
        }
        // Output to a background tab lights its unread badge. Only sync on a
        // transition (unread false→true, or the pane's working state flips) —
        // every other chunk is a no-op, so this stays off the hot per-chunk
        // path.
        const owner = tabs.find((t) => t.manager.paneIds().includes(id));
        const unreadChanged =
          owner !== undefined &&
          owner !== tabs[active] &&
          !unread.has(owner.key);
        if (unreadChanged) {
          unread.add(owner.key);
        }
        if (unreadChanged || workingChanged) {
          syncViews();
        }
        // Re-sync once shortly after this pane's recency window can expire,
        // so the fallback's working→idle flip renders without the poller.
        const pending = activityResync.get(id);
        if (pending !== undefined) {
          clearTimeout(pending);
        }
        activityResync.set(
          id,
          setTimeout(() => {
            activityResync.delete(id);
            syncViews();
          }, 3200),
        );
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
          // A drop while the board is up belongs to the logo panel, not the
          // terminal hiding behind it.
          if (boardOpen.value) {
            return;
          }
          activeManager()?.fileDragOver(x, y);
        },
        onDrop(x, y, paths) {
          if (boardOpen.value) {
            return;
          }
          activeManager()?.fileDrop(x, y, paths);
        },
        onLeave() {
          if (boardOpen.value) {
            return;
          }
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
    // Session restore is gone: the app always opens on the Open board, and the
    // user reopens folders from Recents by hand.
    poller.start();
    syncViews();
  }

  return {
    init,
    materialize,
    openFromPreset,
    findTabByWorkspace: findWorkspaceIndex,
    activeWorkspacePath() {
      return active >= 0 && active < tabs.length
        ? tabs[active].workspacePath
        : null;
    },
    captureActiveLayout,
    activePaneCwd,
    newTab,
    reopenTab,
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
    allPaneIds,
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
      launcher.dispose();
      poller.stop();
      for (const pending of activityResync.values()) {
        clearTimeout(pending);
      }
      activityResync.clear();
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
