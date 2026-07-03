import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Settings } from "../settings/settings-schema";
import { settings } from "../settings/settings-store";
import {
  leaf,
  leafIds,
  removeLeaf,
  replaceLeaf,
  setRatio,
  splitLeaf,
  type Direction,
  type TreeNode,
} from "../lib/split-tree";
import { renderTree } from "./layout";
import { matchBinding } from "./keymap";
import { createPane, type Pane, type PaneEvents } from "./pane";

const EVENT_OUTPUT = "pty:output";
const EVENT_EXIT = "pty:exit";

// Placeholder size at spawn — fit() after mount resizes to the real dimensions
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

interface OutputPayload {
  id: number;
  data: string;
}

interface ExitPayload {
  id: number;
}

export interface TerminalManager {
  init(container: HTMLElement): Promise<void>;
  splitActive(dir: Direction): Promise<void>;
  closeActive(): Promise<void>;
  applySettings(next: Settings): void;
  focusActive(): void;
  dispose(): void;
}

export function createTerminalManager(): TerminalManager {
  const panes = new Map<number, Pane>();
  const exited = new Set<number>();
  const respawning = new Set<number>();
  const unlisteners: UnlistenFn[] = [];
  let tree: TreeNode | null = null;
  let activeId: number | null = null;
  let container: HTMLElement | null = null;

  const paneEvents: PaneEvents = {
    onData(id, data) {
      if (exited.has(id)) {
        if (data === "\r") {
          void respawn(id);
        }
        return;
      }
      invoke("write_pty", { id, data }).catch((err: unknown) => {
        console.error("write_pty failed:", err);
      });
    },
    onResize(id, cols, rows) {
      if (exited.has(id)) {
        return;
      }
      invoke("resize_pty", { id, cols, rows }).catch(() => {
        // Session closed mid-flight — ignore
      });
    },
    onFocus(id) {
      setActive(id);
    },
  };

  async function spawnPane(): Promise<Pane> {
    const id = await invoke<number>("spawn_shell", {
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
    });
    const pane = createPane(id, settings.value, paneEvents);
    panes.set(id, pane);
    return pane;
  }

  // Cleans up a freshly spawned pane whose target vanished during the
  // spawn round-trip — otherwise the PTY + xterm instance would leak
  function discardPane(pane: Pane): void {
    invoke("kill_pty", { id: pane.id }).catch(() => {
      // Session already gone — ignore
    });
    panes.delete(pane.id);
    pane.dispose();
  }

  function isInTree(id: number): boolean {
    return tree !== null && panes.has(id) && leafIds(tree).includes(id);
  }

  function render(): void {
    if (!container || !tree) {
      return;
    }
    renderTree(container, tree, {
      getPaneElement: (id) => panes.get(id)?.element,
      isActive: (id) => id === activeId,
      highlightActive: panes.size > 1,
      onRatioCommit(path, ratio) {
        if (tree) {
          tree = setRatio(tree, path, ratio);
        }
      },
    });
    for (const id of leafIds(tree)) {
      panes.get(id)?.mount();
    }
  }

  function setActive(id: number): void {
    if (activeId === id) {
      return;
    }
    activeId = id;
    updateActiveClasses();
  }

  function updateActiveClasses(): void {
    if (!container) {
      return;
    }
    const highlight = panes.size > 1;
    for (const slot of container.querySelectorAll<HTMLElement>(".pane-slot")) {
      slot.classList.toggle(
        "is-active",
        highlight && Number(slot.dataset.paneId) === activeId,
      );
    }
  }

  function handleExit(id: number): void {
    const pane = panes.get(id);
    if (!pane) {
      return;
    }
    if (panes.size > 1) {
      // Shell exited (typed exit / process died) → auto-close that pane
      void closePane(id);
      return;
    }
    exited.add(id);
    pane.writeln(
      "\r\n\x1b[33m[Session ended — press Enter to start a new one]\x1b[0m",
    );
  }

  async function respawn(oldId: number): Promise<void> {
    // Guard against a second Enter while spawn_shell is still in flight
    if (respawning.has(oldId)) {
      return;
    }
    const old = panes.get(oldId);
    if (!old || !tree) {
      return;
    }
    respawning.add(oldId);
    try {
      const fresh = await spawnPane();
      if (!isInTree(oldId)) {
        discardPane(fresh);
        return;
      }
      tree = replaceLeaf(tree, oldId, fresh.id);
      panes.delete(oldId);
      exited.delete(oldId);
      old.dispose();
      if (activeId === oldId) {
        activeId = fresh.id;
      }
      render();
      fresh.focus();
    } catch (err) {
      if (panes.has(oldId)) {
        old.writeln(`\r\n\x1b[31mFailed to start shell: ${err}\x1b[0m`);
      }
    } finally {
      respawning.delete(oldId);
    }
  }

  async function closePane(id: number): Promise<void> {
    const pane = panes.get(id);
    if (!pane || !tree) {
      return;
    }
    invoke("kill_pty", { id }).catch(() => {
      // Session already ended on its own — ignore
    });
    panes.delete(id);
    exited.delete(id);
    pane.dispose();

    const rest = removeLeaf(tree, id);
    if (rest === null) {
      // Last pane — always keep at least one terminal
      tree = null;
      activeId = null;
      await openInitialPane();
      return;
    }
    tree = rest;
    if (activeId === id) {
      activeId = leafIds(tree)[0] ?? null;
    }
    render();
    if (activeId !== null) {
      panes.get(activeId)?.focus();
    }
  }

  async function openInitialPane(): Promise<void> {
    try {
      const pane = await spawnPane();
      tree = leaf(pane.id);
      activeId = pane.id;
      render();
      pane.focus();
    } catch (err) {
      if (container) {
        container.textContent = `Failed to start shell: ${err}`;
      }
    }
  }

  async function splitActive(dir: Direction): Promise<void> {
    if (!tree || activeId === null) {
      return;
    }
    const targetId = activeId;
    try {
      const pane = await spawnPane();
      if (!isInTree(targetId)) {
        // Target pane closed while spawning — drop the new session
        discardPane(pane);
        return;
      }
      tree = splitLeaf(tree, targetId, pane.id, dir);
      render();
      setActive(pane.id);
      pane.focus();
    } catch (err) {
      panes
        .get(targetId)
        ?.writeln(`\r\n\x1b[31mFailed to open new pane: ${err}\x1b[0m`);
    }
  }

  function cycleFocus(step: 1 | -1): void {
    if (!tree || activeId === null) {
      return;
    }
    const ids = leafIds(tree);
    const index = ids.indexOf(activeId);
    const next = ids[(index + step + ids.length) % ids.length];
    setActive(next);
    panes.get(next)?.focus();
  }

  function handleShortcut(event: KeyboardEvent): void {
    const action = matchBinding(event);
    if (!action) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    switch (action) {
      case "split-row":
        void splitActive("row");
        break;
      case "split-column":
        void splitActive("column");
        break;
      case "close-pane":
        void closeActive();
        break;
      case "focus-next":
        cycleFocus(1);
        break;
      case "focus-prev":
        cycleFocus(-1);
        break;
    }
  }

  async function init(el: HTMLElement): Promise<void> {
    container = el;
    unlisteners.push(
      await listen<OutputPayload>(EVENT_OUTPUT, (event) => {
        panes.get(event.payload.id)?.write(event.payload.data);
      }),
    );
    unlisteners.push(
      await listen<ExitPayload>(EVENT_EXIT, (event) => {
        handleExit(event.payload.id);
      }),
    );
    window.addEventListener("keydown", handleShortcut, true);
    await openInitialPane();
  }

  function closeActive(): Promise<void> {
    return activeId === null ? Promise.resolve() : closePane(activeId);
  }

  return {
    init,
    splitActive,
    closeActive,
    applySettings(next) {
      for (const pane of panes.values()) {
        pane.applySettings(next);
      }
    },
    focusActive() {
      if (activeId !== null) {
        panes.get(activeId)?.focus();
      }
    },
    dispose() {
      window.removeEventListener("keydown", handleShortcut, true);
      for (const unlisten of unlisteners) {
        unlisten();
      }
      for (const pane of panes.values()) {
        pane.dispose();
      }
      panes.clear();
    },
  };
}
