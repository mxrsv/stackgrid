import { signal } from "@preact/signals";

/** Mirror of the Rust `AgentInfo` payload from `detect_agents`. */
export interface DetectedAgent {
  readonly name: string;
  readonly path: string;
}

/** Panes awaiting their one-shot agent pick for this materialization. */
export const pendingPaneIds = signal<readonly number[]>([]);

/** Result of the last `detect_agents` call (allowlist order). */
export const detectedAgents = signal<readonly DetectedAgent[]>([]);

export function beginPick(paneIds: readonly number[]): void {
  const merged = new Set([...pendingPaneIds.value, ...paneIds]);
  pendingPaneIds.value = [...merged];
}

export function resolvePane(id: number): void {
  if (!pendingPaneIds.value.includes(id)) {
    return;
  }
  pendingPaneIds.value = pendingPaneIds.value.filter(
    (paneId) => paneId !== id,
  );
}

export function skipAll(): void {
  pendingPaneIds.value = [];
}

/** Panes can close while pending (exit, tab close) — drop the dead ids. */
export function prunePending(alive: readonly number[]): void {
  const aliveSet = new Set(alive);
  const next = pendingPaneIds.value.filter((id) => aliveSet.has(id));
  if (next.length !== pendingPaneIds.value.length) {
    pendingPaneIds.value = next;
  }
}
