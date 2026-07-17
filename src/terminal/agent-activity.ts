import { lastProgressState, OSC_CARRY_LENGTH } from "../lib/osc-progress";

/**
 * Per-pane "is the program actually working?" tracker, fed from raw PTY
 * output. Two signals, most precise first:
 *
 * 1. OSC 9;4 progress reports (Claude Code emits these once the PTY env
 *    advertises support — see pty.rs; Ghostty renders the same reports as its
 *    native progress bar). Once a pane has emitted one, it is the sole source
 *    of truth for that pane — non-zero state means working. Reports are
 *    parsed from EVERY chunk, even echo (Enter is input, and the busy report
 *    lands right behind it).
 * 2. A heuristic fallback for programs that never report progress
 *    (codex/gemini): working = a SUSTAINED stream of output — at least
 *    `minStreakMs` of continuous activity, still fresh within `recentMs` —
 *    where output arriving within `echoMs` of the user's own keystrokes is
 *    ignored (it's the TUI echoing input, not work), and a single isolated
 *    repaint (idle status refresh) never counts because its span is ~0ms.
 *
 * The caller gates this by "an agent runs in the pane" — a chatty shell job
 * doesn't reach the spinner because isAgent() is false for it.
 */
export interface AgentActivity {
  /** Feed one PTY output chunk. True when the pane's working state flipped. */
  noteOutput(paneId: number, chunk: string): boolean;
  /** The user wrote to this pane (keystroke/paste) — starts an echo window. */
  noteInput(paneId: number): void;
  /**
   * Foreground process of the pane as last polled. A change (agent exited to
   * the shell, a new agent started) resets the pane's record so a stale OSC
   * "busy" from a killed process can't pin the spinner on forever.
   */
  noteProcess(paneId: number, process: string | null): void;
  /** Is this pane working right now? Unknown panes are not. */
  working(paneId: number): boolean;
  /** Forget every pane outside `live` — call after a pane/tab closes. */
  prune(live: readonly number[]): void;
}

interface PaneRecord {
  /** Trailing bytes of the last chunk — catches OSC split across reads. */
  carry: string;
  /** Last OSC 9;4 state; null until the pane first reports progress. */
  oscState: number | null;
  /** Start of the current non-echo output streak (fallback signal). */
  streakStart: number;
  lastOutputAt: number;
  lastInputAt: number;
  lastProcess: string | null;
}

const DEFAULT_RECENT_MS = 3000;
const DEFAULT_ECHO_MS = 300;
const DEFAULT_STREAK_GAP_MS = 1200;
const DEFAULT_MIN_STREAK_MS = 400;

export interface AgentActivityOptions {
  /** Injectable clock for tests. */
  now?: () => number;
  /** How long after the last output a working pane still counts as working. */
  recentMs?: number;
  /** Output arriving this soon after user input is echo, not work. */
  echoMs?: number;
  /** A silence longer than this starts a new streak. */
  streakGapMs?: number;
  /** A streak must span at least this long before it reads as working. */
  minStreakMs?: number;
}

function freshRecord(): PaneRecord {
  return {
    carry: "",
    oscState: null,
    streakStart: 0,
    lastOutputAt: 0,
    lastInputAt: 0,
    lastProcess: null,
  };
}

export function createAgentActivity(
  options: AgentActivityOptions = {},
): AgentActivity {
  const now = options.now ?? Date.now;
  const recentMs = options.recentMs ?? DEFAULT_RECENT_MS;
  const echoMs = options.echoMs ?? DEFAULT_ECHO_MS;
  const streakGapMs = options.streakGapMs ?? DEFAULT_STREAK_GAP_MS;
  const minStreakMs = options.minStreakMs ?? DEFAULT_MIN_STREAK_MS;
  const panes = new Map<number, PaneRecord>();

  function isWorking(record: PaneRecord | undefined, at: number): boolean {
    if (record === undefined) {
      return false;
    }
    if (record.oscState !== null) {
      return record.oscState !== 0;
    }
    return (
      record.lastOutputAt !== 0 &&
      at - record.lastOutputAt < recentMs &&
      record.lastOutputAt - record.streakStart >= minStreakMs
    );
  }

  function getOrCreate(paneId: number): PaneRecord {
    let record = panes.get(paneId);
    if (record === undefined) {
      record = freshRecord();
      panes.set(paneId, record);
    }
    return record;
  }

  return {
    noteOutput(paneId, chunk) {
      const record = getOrCreate(paneId);
      const at = now();
      const before = isWorking(record, at);
      // OSC reports are parsed from every chunk — Enter is user input, and
      // the "busy" report rides the redraw that follows it immediately.
      const text = record.carry + chunk;
      const state = lastProgressState(text);
      record.carry = text.slice(-OSC_CARRY_LENGTH);
      if (state !== null) {
        record.oscState = state;
      }
      // Echo suppression applies only to the fallback bookkeeping: output on
      // the heels of a keystroke is the TUI redrawing its input box.
      if (at - record.lastInputAt >= echoMs) {
        if (at - record.lastOutputAt > streakGapMs) {
          record.streakStart = at; // silence ended — a new streak begins
        }
        record.lastOutputAt = at;
      }
      return isWorking(record, at) !== before;
    },
    noteInput(paneId) {
      getOrCreate(paneId).lastInputAt = now();
    },
    noteProcess(paneId, process) {
      const record = getOrCreate(paneId);
      if (record.lastProcess === process) {
        return;
      }
      const hadProcess = record.lastProcess !== null;
      record.lastProcess = process;
      if (hadProcess) {
        // The pane's program changed under us — everything the old program
        // reported (or streamed) is stale.
        record.oscState = null;
        record.streakStart = 0;
        record.lastOutputAt = 0;
        record.carry = "";
      }
    },
    working(paneId) {
      return isWorking(panes.get(paneId), now());
    },
    prune(live) {
      const keep = new Set(live);
      for (const id of panes.keys()) {
        if (!keep.has(id)) {
          panes.delete(id);
        }
      }
    },
  };
}
