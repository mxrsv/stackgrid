import type { AttentionKind } from "./agent-attention";
import type { AgentNotificationPayload } from "../lib/native-notification";

/**
 * Pure, injectable policy for turning an `AgentAttentionTracker` transition
 * into a native OS notification. This module is deliberately dumb: it never
 * imports Tauri, the settings store, or a window-focus API — every fact it
 * needs (setting enabled, window focus, and the permission-guarded `send`
 * from Task 20's adapter) arrives through `AgentNotifierDeps`, so it can be
 * unit tested with plain fakes and wired to real sources by the caller
 * (Task 23).
 *
 * The notification copy is built from ONLY `workspaceLabel` + `agentLabel` +
 * a fixed phrase per `AttentionKind`. It never receives raw terminal/OSC
 * text, so it cannot leak any into a notification.
 */

/** Injected dependencies — kept as three plain functions so the notifier
 * stays pure and testable without touching Tauri or the settings store. */
export interface AgentNotifierDeps {
  /** Whether the user has enabled agent notifications (settings.agentNotifications). */
  isEnabled: () => boolean;
  /** Live window-focus state. Native notifications are background-only — the
   * in-app attention rail already covers the foreground case. */
  isWindowFocused: () => boolean;
  /** Task 20's permission-guarded adapter `send` — the notifier never talks
   * to the OS notification API itself. */
  send: (payload: AgentNotificationPayload) => void;
}

/** One attention transition the caller wants evaluated for a notification. */
export interface AttentionNotification {
  paneId: number;
  /** The tracker snapshot revision this transition carries — half of the
   * notifier's dedupe key (the other half is `paneId`). Monotonic per pane. */
  revision: number;
  kind: AttentionKind;
  /** Normalized workspace/tab label — never raw terminal text. */
  workspaceLabel: string;
  /** Normalized agent/process label — never raw terminal text. */
  agentLabel: string | null;
}

/** The notifier's public surface — see `createAgentNotifier`. */
export interface AgentNotifier {
  /** Evaluate one transition; fires at most one `send` per (paneId, revision). */
  maybeNotify(n: AttentionNotification): void;
  /** Forget dedupe state for panes outside `live` — call after a pane/tab closes. */
  prune(live: readonly number[]): void;
}

/**
 * Fixed, deterministic copy per actionable kind — the ONLY kind-derived text
 * that reaches a notification. `"none"` is intentionally absent: it is the
 * one `AttentionKind` value that never justifies a notification.
 */
const KIND_PHRASE: Record<Exclude<AttentionKind, "none">, string> = {
  completed: "finished",
  requested: "needs attention",
  warning: "warning",
  error: "error",
};

/**
 * Build the injectable, transition-driven notification policy described in
 * the module doc. `maybeNotify` fires `deps.send` only when every gate
 * holds:
 *
 * 1. `deps.isEnabled()` is true.
 * 2. `deps.isWindowFocused()` is false (background-only).
 * 3. `n.kind` is actionable (anything but `"none"`).
 * 4. This exact `(paneId, revision)` pair has not been notified yet.
 *
 * Dedupe state is only recorded once a notification actually fires, so a
 * transition suppressed by an earlier gate (disabled, foreground, or
 * non-actionable) never blocks a later, otherwise-eligible attempt at the
 * same revision.
 */
export function createAgentNotifier(deps: AgentNotifierDeps): AgentNotifier {
  // paneId -> last revision actually notified for that pane.
  const lastNotified = new Map<number, number>();

  return {
    maybeNotify(n) {
      if (!deps.isEnabled() || deps.isWindowFocused() || n.kind === "none") {
        return;
      }
      if (lastNotified.get(n.paneId) === n.revision) {
        return; // duplicate revision — already notified, not a re-render/next-poll fire
      }
      lastNotified.set(n.paneId, n.revision);

      const phrase = KIND_PHRASE[n.kind];
      const agent = n.agentLabel ?? "Agent";
      deps.send({
        title: n.workspaceLabel,
        body: `${agent} ${phrase}`,
      });
    },

    prune(live) {
      const keep = new Set(live);
      const doomed: number[] = [];
      for (const paneId of lastNotified.keys()) {
        if (!keep.has(paneId)) {
          doomed.push(paneId);
        }
      }
      for (const paneId of doomed) {
        lastNotified.delete(paneId);
      }
    },
  };
}
