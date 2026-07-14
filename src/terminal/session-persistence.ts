import { Store } from "@tauri-apps/plugin-store";
import { validateSession, type SessionData } from "../lib/session-schema";
import { flushSettingsSave } from "../settings/settings-store";
import { reportPersistError } from "../chrome/events";

const SESSION_FILE = "session.json";
const SESSION_KEY = "session";
const SAVE_DEBOUNCE_MS = 500;

let store: Store | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBuild: (() => SessionData | null) | null = null;

/** Load and validate the persisted session; null means "start fresh". */
export async function loadSession(): Promise<SessionData | null> {
  try {
    store = await Store.load(SESSION_FILE, { defaults: {}, autoSave: false });
    const raw = await store.get<unknown>(SESSION_KEY);
    const session = validateSession(raw);
    if (raw !== undefined && raw !== null && session === null) {
      console.warn("Invalid session.json — starting with a fresh tab");
    }
    return session;
  } catch (err) {
    console.warn("Failed to load session, starting fresh:", err);
    return null;
  }
}

/**
 * Debounced save. `build` runs when the timer fires so the snapshot is
 * always current; returning null skips the write.
 */
export function scheduleSessionSave(build: () => SessionData | null): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  pendingBuild = build;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    pendingBuild = null;
    void writeSession(build);
  }, SAVE_DEBOUNCE_MS);
}

async function writeSession(build: () => SessionData | null): Promise<void> {
  const data = build();
  if (data === null || store === null) {
    return;
  }
  try {
    await store.set(SESSION_KEY, data);
    await store.save();
  } catch (err: unknown) {
    // Layout/tab state may silently fail to land on disk otherwise — mirror
    // settings/presets/workspaces so the user learns before they quit and
    // lose the last ≤500ms of changes for good.
    console.warn("Failed to save session:", err);
    reportPersistError("Layout wasn't saved to disk");
  }
}

/**
 * Runs a still-pending debounced save right now — quit paths call this so
 * the last ≤500ms of chrome changes are not lost when the process exits.
 */
export async function flushSessionSave(): Promise<void> {
  if (saveTimer === null || pendingBuild === null) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = null;
  const build = pendingBuild;
  pendingBuild = null;
  await writeSession(build);
}

/** Everything the quit paths must persist before the process exits. */
export async function flushPendingSaves(): Promise<void> {
  await Promise.all([flushSessionSave(), flushSettingsSave()]);
}
