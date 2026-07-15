import { signal } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import {
  pushRecent,
  validateWorkspaces,
  WORKSPACES_VERSION,
  type AgentChoice,
  type WorkspacesData,
} from "../lib/workspace-recents";
import { reportPersistError } from "../chrome/events";

const STORE_FILE = "workspaces.json";
const STORE_KEY = "workspaces";

export const workspacesData = signal<WorkspacesData>({
  version: WORKSPACES_VERSION,
  recents: [],
});

let store: Store | null = null;

/** Load recents at startup — on failure fall back to empty, app keeps running. */
export async function initWorkspaces(): Promise<void> {
  try {
    store = await Store.load(STORE_FILE, { defaults: {}, autoSave: false });
    const raw = await store.get<unknown>(STORE_KEY);
    workspacesData.value = validateWorkspaces(raw);
  } catch (err) {
    console.warn("Failed to load workspace recents, starting empty:", err);
  }
}

/**
 * Record a folder opened from the board, remembering the layout + agent combo.
 * A `presetId`/`agent` of `undefined` keeps the folder's existing memory (see
 * `pushRecent`) — the dedupe path passes neither, so re-focusing a tab that
 * already exists never clobbers what it last opened with.
 */
export function recordWorkspaceOpen(
  path: string,
  presetId?: string,
  agent?: AgentChoice,
): void {
  const next: WorkspacesData = {
    version: WORKSPACES_VERSION,
    recents: pushRecent(
      workspacesData.value.recents,
      path,
      Date.now(),
      presetId,
      agent,
    ),
  };
  workspacesData.value = next;
  if (!store) {
    reportPersistError("Recent folder wasn't saved (storage unavailable)");
    return;
  }
  store
    .set(STORE_KEY, next)
    .then(() => store?.save())
    .catch((err: unknown) => {
      console.warn("Failed to save workspace recents:", err);
      reportPersistError("Recent folder wasn't saved to disk");
    });
}
