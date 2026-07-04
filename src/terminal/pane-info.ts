import { invoke } from "@tauri-apps/api/core";
import type { PaneProcessInfo } from "../lib/process-info";

/**
 * Fresh (non-polled) pty_info for the given panes. The 2s poll cache can be
 * stale at decision points (spawn cwd, close guard) — this is the cheap
 * single-shot alternative. Failure degrades to [] (matches the poll loop's
 * degrade-to-None contract).
 */
export async function freshPaneInfo(
  ids: readonly number[],
): Promise<PaneProcessInfo[]> {
  if (ids.length === 0) {
    return [];
  }
  try {
    return await invoke<PaneProcessInfo[]>("pty_info", { ids: [...ids] });
  } catch (err) {
    console.warn("pty_info failed:", err);
    return [];
  }
}

/** Fresh cwd of one pane; null on failure (spawn then falls back to $HOME). */
export async function freshCwd(id: number | null): Promise<string | null> {
  if (id === null) {
    return null;
  }
  const infos = await freshPaneInfo([id]);
  return infos.find((info) => info.id === id)?.cwd ?? null;
}
