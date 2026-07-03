import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../settings/settings-schema";
import { settings } from "../settings/settings-store";
import {
  countLeaves,
  expandForPane,
  leaf,
  leafIds,
  movePane,
  removeLeaf,
  replaceLeaf,
  serializeTree,
  setRatio,
  splitLeaf,
  treeFromLayout,
  type Direction,
  type Edge,
  type SerializedNode,
  type TreeNode,
} from "../lib/split-tree";
import { paneHeaderInfo, type PaneProcessInfo } from "../lib/process-info";
import { shellEscapePaths } from "../lib/shell-escape";
import { applyRatios, renderTree } from "./layout";
import { createPane, type Pane, type PaneEvents } from "./pane";
import { createPaneDragController, type PaneDragController } from "./pane-drag";

// Placeholder size at spawn — fit() after mount resizes to the real dimensions
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

// Minimum share the active pane gets on each split along its path (Focus Expand)
const EXPAND_RATIO = 0.65;

export interface ManagerCallbacks {
  /** Fired after any structural change (split, close, ratio commit). */
  onLayoutChange(): void;
}

/** One tab's worth of terminals: a split tree of panes sharing a container. */
export interface TerminalManager {
  /** Spawn a single fresh shell. Throws when the spawn fails. */
  initFresh(): Promise<void>;
  /** Spawn one shell per leaf and rebuild the split structure. Throws when any spawn fails. */
  initFromLayout(layout: SerializedNode): Promise<void>;
  show(): void;
  hide(): void;
  splitActive(dir: Direction): Promise<void>;
  closeActive(): Promise<void>;
  cycleFocus(step: 1 | -1): void;
  focusActive(): void;
  applySettings(next: Settings): void;
  serializeLayout(): SerializedNode | null;
  paneIds(): number[];
  activePaneId(): number | null;
  paneCount(): number;
  /** Routed from the tab manager's single pty:output listener; ignores unowned ids. */
  handleOutput(id: number, data: string): void;
  /** Routed from the tab manager's single pty:exit listener; ignores unowned ids. */
  handleExit(id: number): void;
  updatePaneInfo(infos: readonly PaneProcessInfo[], home: string): void;
  /** Write an error line into the active pane (used for tab spawn failures). */
  notifyError(message: string): void;
  /** Highlight the pane under the cursor while dragging files (logical CSS px). */
  fileDragOver(x: number, y: number): void;
  /** Clear any drop-target highlight. */
  fileDragLeave(): void;
  /** Write the (shell-escaped) paths into the PTY of the pane under the cursor. */
  fileDrop(x: number, y: number, paths: string[]): void;
  /** Kills all PTYs, disposes xterm instances and removes the container. */
  dispose(): void;
}

export function createTerminalManager(
  container: HTMLElement,
  callbacks: ManagerCallbacks,
): TerminalManager {
  const panes = new Map<number, Pane>();
  const exited = new Set<number>();
  const respawning = new Set<number>();
  let tree: TreeNode | null = null;
  let activeId: number | null = null;

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

  /** Tree used for display: expand overlay when the mode is on, else the original. */
  function displayTree(): TreeNode | null {
    if (!tree) {
      return null;
    }
    if (!settings.value.focusExpand || panes.size <= 1 || activeId === null) {
      return tree;
    }
    return expandForPane(tree, activeId, EXPAND_RATIO);
  }

  function render(): void {
    if (!tree) {
      return;
    }
    container.classList.toggle("has-multiple-panes", panes.size > 1);
    // Build from the ORIGINAL tree so dividers capture original ratios as
    // their commit baseline (onUp fires even on a click without dragging).
    renderTree(container, tree, {
      getPaneElement: (id) => panes.get(id)?.element,
      isActive: (id) => id === activeId,
      highlightActive: panes.size > 1,
      onRatioCommit(path, ratio) {
        if (tree) {
          tree = setRatio(tree, path, ratio);
          // Re-apply the expand overlay on top of the new committed ratio
          applyRatios(container, displayTree());
          callbacks.onLayoutChange();
        }
      },
    });
    for (const id of leafIds(tree)) {
      panes.get(id)?.mount();
    }
    // Overlay the expand ratios without rebuilding (animates via CSS)
    applyRatios(container, displayTree());
  }

  function setActive(id: number): void {
    if (activeId === id) {
      return;
    }
    activeId = id;
    updateActiveClasses();
    applyRatios(container, displayTree());
  }

  function updateActiveClasses(): void {
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
      // Last pane in the tab — always keep at least one terminal
      tree = null;
      activeId = null;
      await openInitialPane();
      callbacks.onLayoutChange();
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
    callbacks.onLayoutChange();
  }

  async function openInitialPane(): Promise<void> {
    try {
      const pane = await spawnPane();
      tree = leaf(pane.id);
      activeId = pane.id;
      render();
      pane.focus();
    } catch (err) {
      container.textContent = `Failed to start shell: ${err}`;
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
      // Assign directly instead of setActive: setActive applies ratios to the
      // DOM, which does not match the just-split tree until render() runs.
      activeId = pane.id;
      render();
      pane.focus();
      callbacks.onLayoutChange();
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

  async function initFresh(): Promise<void> {
    const pane = await spawnPane();
    tree = leaf(pane.id);
    activeId = pane.id;
    render();
    pane.focus();
  }

  async function initFromLayout(layout: SerializedNode): Promise<void> {
    const total = countLeaves(layout);
    const spawned: Pane[] = [];
    try {
      for (let i = 0; i < total; i += 1) {
        spawned.push(await spawnPane());
      }
    } catch (err) {
      for (const pane of spawned) {
        discardPane(pane);
      }
      throw err;
    }
    tree = treeFromLayout(
      layout,
      spawned.map((pane) => pane.id),
    );
    activeId = spawned[0]?.id ?? null;
    render();
    spawned[0]?.focus();
  }

  function slotAt(x: number, y: number): HTMLElement | null {
    for (const slot of container.querySelectorAll<HTMLElement>(".pane-slot")) {
      const r = slot.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return slot;
      }
    }
    return null;
  }

  function clearDropTargets(): void {
    for (const slot of container.querySelectorAll<HTMLElement>(
      ".pane-slot.is-drop-target",
    )) {
      slot.classList.remove("is-drop-target");
    }
  }

  function fileDragOver(x: number, y: number): void {
    clearDropTargets();
    slotAt(x, y)?.classList.add("is-drop-target");
  }

  function fileDragLeave(): void {
    clearDropTargets();
  }

  function fileDrop(x: number, y: number, paths: string[]): void {
    clearDropTargets();
    const slot = slotAt(x, y);
    if (!slot) {
      return; // dropped outside every pane (tab bar / status bar) — ignore
    }
    const id = Number(slot.dataset.paneId);
    if (!panes.has(id) || exited.has(id)) {
      return; // pane already exited — never write into a dead PTY
    }
    const data = shellEscapePaths(paths);
    if (data === "") {
      return;
    }
    invoke("write_pty", { id, data }).catch((err: unknown) => {
      console.error("write_pty failed:", err);
    });
    setActive(id);
    panes.get(id)?.focus();
  }

  const paneDrag: PaneDragController = createPaneDragController(container, {
    paneCount: () => panes.size,
    onMove(sourceId: number, targetId: number, edge: Edge) {
      if (!tree) {
        return;
      }
      const next = movePane(tree, sourceId, targetId, edge);
      if (next === tree) {
        return; // no-op: invalid ids, or source/target closed mid-drag
      }
      tree = next;
      render();
      setActive(sourceId);
      panes.get(sourceId)?.focus();
      callbacks.onLayoutChange();
    },
  });

  return {
    initFresh,
    initFromLayout,
    show() {
      container.style.display = "";
      for (const pane of panes.values()) {
        pane.fit();
      }
      if (activeId !== null) {
        panes.get(activeId)?.focus();
      }
    },
    hide() {
      container.style.display = "none";
    },
    splitActive,
    closeActive() {
      return activeId === null ? Promise.resolve() : closePane(activeId);
    },
    cycleFocus,
    focusActive() {
      if (activeId !== null) {
        panes.get(activeId)?.focus();
      }
    },
    applySettings(next) {
      for (const pane of panes.values()) {
        pane.applySettings(next);
      }
      // Idempotent: mode off → displayTree() is the original tree, so this
      // also restores the original layout when the toggle turns off.
      applyRatios(container, displayTree());
    },
    serializeLayout() {
      return tree === null ? null : serializeTree(tree);
    },
    paneIds() {
      return tree === null ? [] : leafIds(tree);
    },
    activePaneId() {
      return activeId;
    },
    paneCount() {
      return panes.size;
    },
    handleOutput(id, data) {
      panes.get(id)?.write(data);
    },
    handleExit,
    updatePaneInfo(infos, home) {
      for (const info of infos) {
        panes.get(info.id)?.setHeaderInfo(paneHeaderInfo(info, home));
      }
    },
    notifyError(message) {
      if (activeId !== null) {
        panes.get(activeId)?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      }
    },
    fileDragOver,
    fileDragLeave,
    fileDrop,
    dispose() {
      paneDrag.dispose();
      for (const pane of panes.values()) {
        invoke("kill_pty", { id: pane.id }).catch(() => {
          // Session already gone — ignore
        });
        pane.dispose();
      }
      panes.clear();
      container.remove();
    },
  };
}
