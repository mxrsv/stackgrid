import { signal } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import {
  pushRecent,
  validateWorkspaces,
  WORKSPACES_VERSION,
  type WorkspacesData,
} from "../lib/workspace-recents";

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

/** Record a folder opened from the board (also called for Open Folder picks). */
export function recordWorkspaceOpen(path: string): void {
  const next: WorkspacesData = {
    version: WORKSPACES_VERSION,
    recents: pushRecent(workspacesData.value.recents, path, Date.now()),
  };
  workspacesData.value = next;
  store
    ?.set(STORE_KEY, next)
    .then(() => store?.save())
    .catch((err: unknown) => {
      console.warn("Failed to save workspace recents:", err);
    });
}
