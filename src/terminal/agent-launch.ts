import type { AgentChoice } from "../lib/workspace-recents";
import { defaultPtyClient, type PtyClient } from "./pty-client";

/**
 * How long to wait for a pane's first byte before typing the agent anyway.
 * A shell that prints nothing on startup (rare, but possible) must not wedge
 * the launch forever — after this we type regardless.
 */
export const AGENT_LAUNCH_TIMEOUT_MS = 3000;

/**
 * Types the chosen agent command into each new pane's interactive shell once
 * the shell is ready. Agents are launched by writing `claude\r` to stdin (not
 * spawned from Rust) so they inherit the login shell's `$PATH` — see spec A1.
 *
 * Readiness is "the pane has printed its first byte" (the prompt is up), or a
 * timeout as a fallback. Each pane is typed into exactly once.
 */
export interface AgentLauncher {
  /** Queue `agent` for each pane; `null` (Shell only) queues nothing. */
  arm(paneIds: readonly number[], agent: AgentChoice): void;
  /** A pane printed output — fire it now if it is armed and not yet launched. */
  noteOutput(id: number): void;
  /** Drop panes that no longer exist, cancelling their pending timers. */
  prune(alive: readonly number[]): void;
  /** Cancel every pending timer (teardown). */
  dispose(): void;
}

interface Armed {
  readonly agent: string;
  readonly timer: ReturnType<typeof setTimeout>;
}

export function createAgentLauncher(
  pty: PtyClient = defaultPtyClient,
  timeoutMs: number = AGENT_LAUNCH_TIMEOUT_MS,
): AgentLauncher {
  const armed = new Map<number, Armed>();
  const sawOutput = new Set<number>();
  const launched = new Set<number>();

  function fire(id: number): void {
    const entry = armed.get(id);
    if (entry === undefined || launched.has(id)) {
      return;
    }
    launched.add(id);
    clearTimeout(entry.timer);
    armed.delete(id);
    pty.writePty(id, `${entry.agent}\r`).catch((err: unknown) => {
      // A failed write leaves the pane as an empty shell — never sink the tab.
      console.error("agent launch write_pty failed:", err);
    });
  }

  return {
    arm(paneIds, agent) {
      if (agent === null) {
        return;
      }
      for (const id of paneIds) {
        if (launched.has(id) || armed.has(id)) {
          continue;
        }
        const timer = setTimeout(() => fire(id), timeoutMs);
        armed.set(id, { agent, timer });
        if (sawOutput.has(id)) {
          fire(id);
        }
      }
    },
    noteOutput(id) {
      sawOutput.add(id);
      if (armed.has(id)) {
        fire(id);
      }
    },
    prune(alive) {
      const aliveSet = new Set(alive);
      for (const [id, entry] of armed) {
        if (!aliveSet.has(id)) {
          clearTimeout(entry.timer);
          armed.delete(id);
        }
      }
      for (const id of sawOutput) {
        if (!aliveSet.has(id)) {
          sawOutput.delete(id);
        }
      }
      for (const id of launched) {
        if (!aliveSet.has(id)) {
          launched.delete(id);
        }
      }
    },
    dispose() {
      for (const entry of armed.values()) {
        clearTimeout(entry.timer);
      }
      armed.clear();
      sawOutput.clear();
      launched.clear();
    },
  };
}
