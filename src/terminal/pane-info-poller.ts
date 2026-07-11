import type { PaneProcessInfo } from "../lib/process-info";
import type { PtyClient } from "./pty-client";

const DEFAULT_INTERVAL_MS = 2000;

/** What the poller needs from its owner (TabManager). */
export interface PaneInfoPollerDeps {
  pty: Pick<PtyClient, "ptyInfo" | "gitBranch">;
  /** Pane ids worth polling right now (tab dots + active tab headers). */
  targets(): readonly number[];
  /** Focused pane of the active tab — its CWD drives the git branch. */
  activePaneId(): number | null;
  /** Fired after every successful poll with the fresh infos. */
  onUpdate(infos: readonly PaneProcessInfo[]): void;
  intervalMs?: number;
}

export interface PaneInfoPoller {
  /** Begin the recurring poll; idempotent while running. */
  start(): void;
  stop(): void;
  /** One immediate poll (materialize / init). Never throws. */
  poll(): Promise<void>;
  /** Last polled info for a pane; undefined before its first poll. */
  infoFor(id: number): PaneProcessInfo | undefined;
  /** Git branch of the focused pane's CWD; null when unknown. */
  branch(): string | null;
}

/**
 * Deep Pane info polling: the pty_info cache, the warn-once degrade contract
 * (keep last-known values, never break the loop) and the git-branch lookup
 * that skips unchanged CWDs.
 */
export function createPaneInfoPoller(deps: PaneInfoPollerDeps): PaneInfoPoller {
  const infoByPane = new Map<number, PaneProcessInfo>();
  let branch: string | null = null;
  let lastBranchCwd: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let warned = false;

  async function updateBranch(): Promise<void> {
    const paneId = deps.activePaneId();
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
      branch = await deps.pty.gitBranch(cwd);
      lastBranchCwd = cwd;
    } catch (err) {
      if (!warned) {
        console.warn("git_branch failed:", err);
        warned = true;
      }
    }
  }

  async function poll(): Promise<void> {
    const ids = deps.targets();
    if (ids.length === 0) {
      return;
    }
    let infos: PaneProcessInfo[];
    try {
      infos = await deps.pty.ptyInfo(ids);
      warned = false;
    } catch (err) {
      // Keep the last known values; warn once, never break the loop
      if (!warned) {
        console.warn("pty_info failed:", err);
        warned = true;
      }
      return;
    }
    for (const info of infos) {
      infoByPane.set(info.id, info);
    }
    await updateBranch();
    deps.onUpdate(infos);
  }

  return {
    start() {
      if (timer !== null) {
        return;
      }
      timer = setInterval(
        () => void poll(),
        deps.intervalMs ?? DEFAULT_INTERVAL_MS,
      );
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
    poll,
    infoFor(id) {
      return infoByPane.get(id);
    },
    branch() {
      return branch;
    },
  };
}
