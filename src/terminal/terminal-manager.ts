import type { Settings } from "../settings/settings-schema";
import { settings } from "../settings/settings-store";
import {
  countLeaves,
  leaf,
  leafIds,
  movePane,
  removeLeaf,
  serializeTree,
  setRatio,
  splitLeaf,
  treeFromLayout,
  type Direction,
  type Edge,
  type SerializedNode,
  type TreeNode,
} from "../lib/split-tree";
import { nearestInDirection, type FocusDirection, type PaneRect } from "../lib/pane-geometry";
import { paneHeaderInfo, type PaneProcessInfo } from "../lib/process-info";
import { shellEscapePaths } from "../lib/shell-escape";
import { createLayoutEngine } from "./layout-engine";
import { createPaneLifecycle } from "./pane-lifecycle";
import { freshCwd } from "./pane-info";
import { defaultPtyClient, type PtyClient } from "./pty-client";
import { createPaneDragController, type PaneDragController } from "./pane-drag";
import { closeSearchBarForPane, openSearchBar } from "./search-bar";

export interface ManagerCallbacks {
  /** Fired after any structural change (split, close, ratio commit). */
  onLayoutChange(): void;
}

/** One tab's worth of terminals: a split tree of panes sharing a container. */
export interface TerminalManager {
  /** Spawn a single fresh shell (at `cwd` when given). Throws when the spawn fails. */
  initFresh(cwd?: string | null): Promise<void>;
  /**
   * Spawn one shell per leaf and rebuild the split structure. `cwds` maps to
   * leaves in left-to-right order (missing/null entries → $HOME). Throws when
   * any spawn fails.
   */
  initFromLayout(layout: SerializedNode, cwds?: readonly (string | null)[]): Promise<void>;
  show(): void;
  hide(): void;
  splitActive(dir: Direction): Promise<void>;
  closeActive(): Promise<void>;
  /** Close a specific pane; unknown id → no-op (it may have exited meanwhile). */
  closePaneById(id: number): Promise<void>;
  cycleFocus(step: 1 | -1): void;
  /** Move focus to the nearest pane in a direction; no pane there → no-op. */
  focusDirection(dir: FocusDirection): void;
  /** Maximize the active pane over the whole tab; call again to restore. */
  toggleZoom(): void;
  focusActive(): void;
  /** Clear the active pane's buffer, keeping the prompt line (Cmd+K). */
  clearActive(): void;
  /** Open the search bar on the active pane (Cmd+F). */
  openSearch(): void;
  applySettings(next: Settings): void;
  serializeLayout(): SerializedNode | null;
  paneIds(): number[];
  activePaneId(): number | null;
  paneCount(): number;
  /** Root element of a pane (overlay anchor for the agent picker). */
  paneElement(id: number): HTMLElement | null;
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
  pty: PtyClient = defaultPtyClient,
): TerminalManager {
  let tree: TreeNode | null = null;
  let activeId: number | null = null;

  // Pane bar visibility is CSS-only: pane.ts always builds and populates the
  // bar (the drag ghost and anchor still read its cwd) — this class hides it.
  container.classList.toggle("pane-bar-hidden", !settings.value.showPaneBar);

  const life = createPaneLifecycle({
    pty,
    getSettings: () => settings.value,
    onWriteWhileExited(id, data) {
      if (data === "\r") {
        void respawn(id);
      }
    },
    onFocus(id) {
      setActive(id);
    },
  });

  const layout = createLayoutEngine(container, {
    getPaneElement: (id) => life.panes.get(id)?.element,
    mountPane: (id) => {
      life.panes.get(id)?.mount();
    },
    fitPane: (id) => {
      life.panes.get(id)?.fit();
    },
    focusPane: (id) => {
      life.panes.get(id)?.focus();
    },
  });

  function overlayInput() {
    if (!tree) {
      return null;
    }
    return {
      tree,
      activeId,
      paneCount: life.panes.size,
      focusExpand: settings.value.focusExpand,
    };
  }

  function render(): void {
    if (!tree) {
      return;
    }
    layout.sync({
      tree,
      activeId,
      paneCount: life.panes.size,
      focusExpand: settings.value.focusExpand,
      onRatioCommit(path, ratio) {
        if (!tree) {
          return;
        }
        tree = setRatio(tree, path, ratio);
        const overlay = overlayInput();
        if (overlay) {
          layout.refreshOverlay(overlay);
        }
        callbacks.onLayoutChange();
      },
    });
  }

  function setActive(id: number): void {
    if (activeId === id) {
      return;
    }
    // Moving focus while zoomed restores the layout (tmux behavior)
    if (layout.zoomedId() !== null && layout.zoomedId() !== id) {
      layout.unzoom();
    }
    activeId = id;
    const overlay = overlayInput();
    if (overlay) {
      layout.refreshOverlay(overlay);
    }
  }

  function handleExit(id: number): void {
    const pane = life.panes.get(id);
    if (!pane) {
      return;
    }
    if (life.panes.size > 1) {
      // Shell exited (typed exit / process died) → auto-close that pane
      void closePane(id);
      return;
    }
    life.exited.add(id);
    pane.writeln("\r\n\x1b[33m[Session ended — press Enter to start a new one]\x1b[0m");
  }

  async function respawn(oldId: number): Promise<void> {
    if (!tree) {
      return;
    }
    const result = await life.respawn(oldId, tree, activeId);
    if (result === null) {
      return;
    }
    tree = result.tree;
    activeId = result.activeId;
    // Mount (term.open) then focus — same order as pre-extraction respawn.
    render();
    if (activeId !== null) {
      life.panes.get(activeId)?.focus();
    }
  }

  async function closePane(id: number): Promise<void> {
    const pane = life.panes.get(id);
    if (!pane || !tree) {
      return;
    }
    life.killPane(id);
    life.panes.delete(id);
    life.exited.delete(id);
    closeSearchBarForPane(id);
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
      life.panes.get(activeId)?.focus();
    }
    callbacks.onLayoutChange();
  }

  async function openInitialPane(): Promise<void> {
    await life.openInitial(
      (nextTree, nextActive) => {
        tree = nextTree;
        activeId = nextActive;
        render();
      },
      (err) => {
        container.textContent = `Failed to start shell: ${err}`;
      },
    );
  }

  async function splitActive(dir: Direction): Promise<void> {
    if (!tree || activeId === null) {
      return;
    }
    const targetId = activeId;
    try {
      // Fresh lookup, not the 2s poll cache — the user may have just cd'd
      const cwd = await freshCwd(targetId, pty);
      const pane = await life.spawnPane(cwd);
      if (!life.isInTree(tree, targetId)) {
        // Target pane closed while spawning — drop the new session
        life.discardPane(pane);
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
      life.panes.get(targetId)?.writeln(`\r\n\x1b[31mFailed to open new pane: ${err}\x1b[0m`);
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
    life.panes.get(next)?.focus();
  }

  function focusDirection(dir: FocusDirection): void {
    if (!tree || activeId === null) {
      return;
    }
    const rects: PaneRect[] = [];
    for (const slot of container.querySelectorAll<HTMLElement>(".pane-slot")) {
      const id = Number(slot.dataset.paneId);
      if (Number.isNaN(id)) {
        continue;
      }
      const r = slot.getBoundingClientRect();
      rects.push({
        id,
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
      });
    }
    const target = nearestInDirection(rects, activeId, dir);
    if (target === null) {
      return;
    }
    // Route through setActive so zoom restore, active classes and expand
    // ratios are inherited rather than re-derived.
    setActive(target);
    life.panes.get(target)?.focus();
  }

  async function initFresh(cwd: string | null = null): Promise<void> {
    const pane = await life.spawnPane(cwd);
    tree = leaf(pane.id);
    activeId = pane.id;
    render();
    pane.focus();
  }

  async function initFromLayout(layoutNode: SerializedNode, cwds: readonly (string | null)[] = []): Promise<void> {
    const total = countLeaves(layoutNode);
    const spawned: Awaited<ReturnType<typeof life.spawnPane>>[] = [];
    try {
      for (let i = 0; i < total; i += 1) {
        spawned.push(await life.spawnPane(cwds[i] ?? null));
      }
    } catch (err) {
      for (const pane of spawned) {
        life.discardPane(pane);
      }
      throw err;
    }
    tree = treeFromLayout(
      layoutNode,
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
    for (const slot of container.querySelectorAll<HTMLElement>(".pane-slot.is-drop-target")) {
      slot.classList.remove("is-drop-target");
    }
  }

  function fileDragOver(x: number, y: number): void {
    clearDropTargets();
    if (layout.zoomedId() !== null) {
      return; // overlay covers the slots — the drop always hits the zoomed pane
    }
    slotAt(x, y)?.classList.add("is-drop-target");
  }

  function fileDragLeave(): void {
    clearDropTargets();
  }

  function fileDrop(x: number, y: number, paths: string[]): void {
    clearDropTargets();
    // While zoomed the overlay covers every slot — the drop belongs to the
    // zoomed pane, not whatever slot happens to sit underneath the cursor.
    const id = layout.zoomedId() ?? Number(slotAt(x, y)?.dataset.paneId ?? NaN);
    if (Number.isNaN(id)) {
      return; // dropped outside every pane (tab bar / status bar) — ignore
    }
    if (!life.panes.has(id) || life.exited.has(id)) {
      return; // pane already exited — never write into a dead PTY
    }
    const data = shellEscapePaths(paths);
    if (data === "") {
      return;
    }
    pty.writePty(id, data).catch((err: unknown) => {
      console.error("write_pty failed:", err);
    });
    setActive(id);
    life.panes.get(id)?.focus();
  }

  const paneDrag: PaneDragController = createPaneDragController(container, {
    paneCount: () => life.panes.size,
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
      life.panes.get(sourceId)?.focus();
      callbacks.onLayoutChange();
    },
  });

  return {
    initFresh,
    initFromLayout,
    show() {
      container.style.display = "";
      for (const pane of life.panes.values()) {
        pane.fit();
      }
      if (activeId !== null) {
        life.panes.get(activeId)?.focus();
      }
    },
    hide() {
      container.style.display = "none";
    },
    splitActive,
    closeActive() {
      return activeId === null ? Promise.resolve() : closePane(activeId);
    },
    closePaneById(id) {
      return closePane(id);
    },
    cycleFocus,
    focusDirection,
    toggleZoom() {
      layout.toggleZoom(activeId, life.panes.size);
    },
    focusActive() {
      if (activeId !== null) {
        life.panes.get(activeId)?.focus();
      }
    },
    clearActive() {
      if (activeId !== null) {
        life.panes.get(activeId)?.clear();
      }
    },
    openSearch() {
      if (activeId !== null) {
        const pane = life.panes.get(activeId);
        if (pane) {
          openSearchBar(pane);
        }
      }
    },
    applySettings(next) {
      container.classList.toggle("pane-bar-hidden", !next.showPaneBar);
      for (const pane of life.panes.values()) {
        pane.applySettings(next);
      }
      // Idempotent: mode off → display tree is the original, so this also
      // restores the original layout when the toggle turns off.
      const overlay = overlayInput();
      if (overlay) {
        layout.refreshOverlay({ ...overlay, focusExpand: next.focusExpand });
      }
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
      return life.panes.size;
    },
    paneElement(id) {
      return life.panes.get(id)?.element ?? null;
    },
    handleOutput(id, data) {
      life.panes.get(id)?.write(data);
    },
    handleExit,
    updatePaneInfo(infos, home) {
      for (const info of infos) {
        life.panes.get(info.id)?.setHeaderInfo(paneHeaderInfo(info, home));
      }
    },
    notifyError(message) {
      if (activeId !== null) {
        life.panes.get(activeId)?.writeln(`\r\n\x1b[31m${message}\x1b[0m`);
      }
    },
    fileDragOver,
    fileDragLeave,
    fileDrop,
    dispose() {
      paneDrag.dispose();
      layout.unzoom();
      life.killAll();
      for (const pane of life.panes.values()) {
        closeSearchBarForPane(pane.id);
        pane.dispose();
      }
      life.panes.clear();
      container.remove();
    },
  };
}
