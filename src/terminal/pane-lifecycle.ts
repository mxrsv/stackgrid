import type { Settings } from "../settings/settings-schema";
import { reportPersistError } from "../chrome/events";
import { leaf, leafIds, replaceLeaf, type TreeNode } from "../lib/split-tree";
import { createPane, type Pane, type PaneEvents } from "./pane";
import { clearPaneCwd, setPaneCwd } from "./pane-cwd";
import type { PtyClient } from "./pty-client";

// Placeholder size at spawn — fit() after mount resizes to the real dimensions
const INITIAL_COLS = 80;
const INITIAL_ROWS = 24;

/** Pane factory seam — real xterm in production, fakes in tests. */
export type CreatePaneFn = (
  id: number,
  initial: Settings,
  events: PaneEvents,
) => Pane;

export interface PaneLifecycle {
  readonly panes: Map<number, Pane>;
  readonly exited: Set<number>;
  spawnPane(cwd?: string | null): Promise<Pane>;
  discardPane(pane: Pane): void;
  killPane(id: number): void;
  killAll(): void;
  isInTree(tree: TreeNode | null, id: number): boolean;
  respawn(
    oldId: number,
    tree: TreeNode,
    activeId: number | null,
  ): Promise<{ tree: TreeNode; activeId: number | null } | null>;
  openInitial(
    onTree: (tree: TreeNode, activeId: number) => void,
    onError: (err: unknown) => void,
  ): Promise<void>;
  paneEvents: PaneEvents;
}

/**
 * Deep Pane PTY lifecycle: spawn / kill / respawn / exit limbo.
 * Layout tree ownership stays with TerminalManager.
 */
export function createPaneLifecycle(deps: {
  pty: PtyClient;
  getSettings: () => Settings;
  onWriteWhileExited: (id: number, data: string) => void;
  onFocus: (id: number) => void;
  /** Test seam — defaults to real createPane (xterm). */
  createPane?: CreatePaneFn;
}): PaneLifecycle {
  const panes = new Map<number, Pane>();
  const exited = new Set<number>();
  const respawning = new Set<number>();
  const makePane = deps.createPane ?? createPane;

  const paneEvents: PaneEvents = {
    onData(id, data) {
      if (exited.has(id)) {
        deps.onWriteWhileExited(id, data);
        return;
      }
      deps.pty.writePty(id, data).catch(() => {
        reportPersistError(
          "Couldn't send input to the terminal — the session may have ended.",
        );
      });
    },
    onResize(id, cols, rows) {
      if (exited.has(id)) {
        return;
      }
      deps.pty.resizePty(id, cols, rows).catch(() => {
        // Session closed mid-flight — ignore
      });
    },
    onFocus(id) {
      deps.onFocus(id);
    },
  };

  async function spawnPane(cwd: string | null = null): Promise<Pane> {
    const id = await deps.pty.spawnShell({
      cols: INITIAL_COLS,
      rows: INITIAL_ROWS,
      cwd,
    });
    const pane = makePane(id, deps.getSettings(), paneEvents);
    panes.set(id, pane);
    // Seed the link provider's cwd — the pty_info poll only refreshes it 2s
    // later, and a path clicked before then would resolve against the wrong dir.
    setPaneCwd(id, cwd);
    return pane;
  }

  function discardPane(pane: Pane): void {
    deps.pty.killPty(pane.id).catch(() => {
      // Session already gone — ignore
    });
    panes.delete(pane.id);
    clearPaneCwd(pane.id);
    pane.dispose();
  }

  function killPane(id: number): void {
    deps.pty.killPty(id).catch(() => {
      // Session already ended on its own — ignore
    });
  }

  function killAll(): void {
    for (const pane of panes.values()) {
      deps.pty.killPty(pane.id).catch(() => {
        // Session already gone — ignore
      });
    }
  }

  function isInTree(tree: TreeNode | null, id: number): boolean {
    return tree !== null && panes.has(id) && leafIds(tree).includes(id);
  }

  async function respawn(
    oldId: number,
    tree: TreeNode,
    activeId: number | null,
  ): Promise<{ tree: TreeNode; activeId: number | null } | null> {
    if (respawning.has(oldId)) {
      return null;
    }
    const old = panes.get(oldId);
    if (!old) {
      return null;
    }
    respawning.add(oldId);
    try {
      const fresh = await spawnPane();
      if (!isInTree(tree, oldId)) {
        discardPane(fresh);
        return null;
      }
      const nextTree = replaceLeaf(tree, oldId, fresh.id);
      panes.delete(oldId);
      exited.delete(oldId);
      clearPaneCwd(oldId);
      old.dispose();
      // Caller must focus after layout mount/render — term.open() runs in mount().
      return {
        tree: nextTree,
        activeId: activeId === oldId ? fresh.id : activeId,
      };
    } catch (err) {
      if (panes.has(oldId)) {
        old.writeln(`\r\n\x1b[31mFailed to start shell: ${err}\x1b[0m`);
      }
      return null;
    } finally {
      respawning.delete(oldId);
    }
  }

  async function openInitial(
    onTree: (tree: TreeNode, activeId: number) => void,
    onError: (err: unknown) => void,
  ): Promise<void> {
    try {
      const pane = await spawnPane();
      onTree(leaf(pane.id), pane.id);
      pane.focus();
    } catch (err) {
      onError(err);
    }
  }

  return {
    panes,
    exited,
    spawnPane,
    discardPane,
    killPane,
    killAll,
    isInTree,
    respawn,
    openInitial,
    paneEvents,
  };
}
