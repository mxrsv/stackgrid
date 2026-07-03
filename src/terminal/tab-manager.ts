import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { homeDir } from "@tauri-apps/api/path";
import type { Settings } from "../settings/settings-schema";
import { settings } from "../settings/settings-store";
import type { Direction, SerializedNode } from "../lib/split-tree";
import { SESSION_VERSION, type SessionData } from "../lib/session-schema";
import { isAgent, type PaneProcessInfo } from "../lib/process-info";
import { matchBinding, selectTabIndex } from "./keymap";
import { loadSession, scheduleSessionSave } from "./session-persistence";
import {
  createTerminalManager,
  type TerminalManager,
} from "./terminal-manager";
import { activeTabIndex, statusInfo, tabViews } from "./tabs-store";

const EVENT_OUTPUT = "pty:output";
const EVENT_EXIT = "pty:exit";
const POLL_INTERVAL_MS = 2000;

interface OutputPayload {
  id: number;
  data: string;
}

interface ExitPayload {
  id: number;
}

interface TabEntry {
  readonly key: number;
  readonly manager: TerminalManager;
}

/** Owns all tabs: routing, keyboard, persistence and (later) info polling. */
export interface TabManager {
  init(): Promise<void>;
  newTab(): Promise<void>;
  closeTab(index: number): Promise<void>;
  selectTab(index: number): void;
  cycleTab(step: 1 | -1): void;
  splitActive(dir: Direction): Promise<void>;
  closePane(): Promise<void>;
  applySettings(next: Settings): void;
  focusActive(): void;
  dispose(): void;
}

export function createTabManager(host: HTMLElement): TabManager {
  const tabs: TabEntry[] = [];
  const unlisteners: UnlistenFn[] = [];
  const infoByPane = new Map<number, PaneProcessInfo>();
  let nextKey = 1;
  let active = -1;
  let home = "";
  let branch: string | null = null;
  let lastBranchCwd: string | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollWarned = false;

  function activeManager(): TerminalManager | null {
    return active >= 0 && active < tabs.length ? tabs[active].manager : null;
  }

  function buildSessionData(): SessionData | null {
    const layouts = tabs
      .map((tab) => tab.manager.serializeLayout())
      .filter((layout): layout is SerializedNode => layout !== null);
    if (layouts.length === 0) {
      return null;
    }
    return {
      version: SESSION_VERSION,
      activeTab: Math.min(Math.max(active, 0), layouts.length - 1),
      tabs: layouts.map((layout) => ({ layout })),
    };
  }

  function persist(): void {
    scheduleSessionSave(buildSessionData);
  }

  function syncViews(): void {
    tabViews.value = tabs.map((tab) => {
      const paneId = tab.manager.activePaneId();
      const info = paneId === null ? undefined : infoByPane.get(paneId);
      return { key: tab.key, process: info?.process ?? null };
    });
    activeTabIndex.value = active;
    const manager = activeManager();
    const paneId = manager?.activePaneId() ?? null;
    const info = paneId === null ? undefined : infoByPane.get(paneId);
    const process = info?.process ?? null;
    statusInfo.value = {
      branch,
      cwd: info?.cwd ?? null,
      agent: isAgent(process) ? process : null,
      paneCount: manager?.paneCount() ?? 0,
      home,
    };
  }

  const callbacks = {
    onLayoutChange(): void {
      syncViews();
      persist();
    },
  };

  /** Create + init a tab; false (and an error note) when spawning fails. */
  async function addTab(layout: SerializedNode | null): Promise<boolean> {
    const container = document.createElement("div");
    container.className = "tab-stage";
    container.style.display = "none";
    host.appendChild(container);
    const manager = createTerminalManager(container, callbacks);
    try {
      if (layout === null) {
        await manager.initFresh();
      } else {
        await manager.initFromLayout(layout);
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

  async function newTab(): Promise<void> {
    if (!(await addTab(null))) {
      return;
    }
    selectTab(tabs.length - 1);
  }

  async function closeTab(index: number): Promise<void> {
    const entry = tabs[index];
    if (!entry) {
      return;
    }
    const closingActive = index === active;
    entry.manager.dispose();
    tabs.splice(index, 1);
    if (tabs.length === 0) {
      // Never show zero tabs — replace the last one with a fresh tab
      active = -1;
      if (!(await addTab(null))) {
        syncViews();
        return;
      }
      active = 0;
      tabs[0].manager.show();
      syncViews();
      persist();
      return;
    }
    if (index < active) {
      active -= 1;
    }
    if (active >= tabs.length) {
      active = tabs.length - 1;
    }
    if (closingActive) {
      tabs[active].manager.show();
    }
    syncViews();
    persist();
  }

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

  async function updateBranch(): Promise<void> {
    const paneId = activeManager()?.activePaneId() ?? null;
    const cwd = paneId === null ? null : (infoByPane.get(paneId)?.cwd ?? null);
    if (cwd === lastBranchCwd) {
      return; // unchanged since the last poll — skip the git call
    }
    if (cwd === null) {
      lastBranchCwd = null;
      branch = null;
      return;
    }
    try {
      branch = await invoke<string | null>("git_branch", { cwd });
      lastBranchCwd = cwd;
    } catch (err) {
      if (!pollWarned) {
        console.warn("git_branch failed:", err);
        pollWarned = true;
      }
    }
  }

  async function poll(): Promise<void> {
    const ids = pollTargets();
    if (ids.length === 0) {
      return;
    }
    let infos: PaneProcessInfo[];
    try {
      infos = await invoke<PaneProcessInfo[]>("pty_info", { ids });
      pollWarned = false;
    } catch (err) {
      // Keep the last known values; warn once, never break the loop
      if (!pollWarned) {
        console.warn("pty_info failed:", err);
        pollWarned = true;
      }
      return;
    }
    for (const info of infos) {
      infoByPane.set(info.id, info);
    }
    activeManager()?.updatePaneInfo(infos, home);
    await updateBranch();
    syncViews();
  }

  function cycleTab(step: 1 | -1): void {
    if (tabs.length < 2) {
      return;
    }
    selectTab((active + step + tabs.length) % tabs.length);
  }

  function handleShortcut(event: KeyboardEvent): void {
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
        void closePane();
        break;
      case "focus-next":
        activeManager()?.cycleFocus(1);
        break;
      case "focus-prev":
        activeManager()?.cycleFocus(-1);
        break;
      case "new-tab":
        void newTab();
        break;
      case "close-tab":
        void closeTab(active);
        break;
      case "next-tab":
        cycleTab(1);
        break;
      case "prev-tab":
        cycleTab(-1);
        break;
    }
  }

  function splitActive(dir: Direction): Promise<void> {
    return activeManager()?.splitActive(dir) ?? Promise.resolve();
  }

  function closePane(): Promise<void> {
    return activeManager()?.closeActive() ?? Promise.resolve();
  }

  async function init(): Promise<void> {
    unlisteners.push(
      await listen<OutputPayload>(EVENT_OUTPUT, (event) => {
        for (const tab of tabs) {
          tab.manager.handleOutput(event.payload.id, event.payload.data);
        }
      }),
    );
    unlisteners.push(
      await listen<ExitPayload>(EVENT_EXIT, (event) => {
        for (const tab of tabs) {
          tab.manager.handleExit(event.payload.id);
        }
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
      for (const tab of session.tabs) {
        await addTab(tab.layout);
      }
    }
    if (tabs.length === 0) {
      await addTab(null);
    }
    if (tabs.length === 0) {
      // Even the fallback tab failed to spawn — errors are already logged
      syncViews();
      return;
    }
    selectTab(
      session === null ? 0 : Math.min(session.activeTab, tabs.length - 1),
    );
    pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    void poll();
  }

  return {
    init,
    newTab,
    closeTab,
    selectTab,
    cycleTab,
    splitActive,
    closePane,
    applySettings(next) {
      for (const tab of tabs) {
        tab.manager.applySettings(next);
      }
    },
    focusActive() {
      activeManager()?.focusActive();
    },
    dispose() {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
      }
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
