import { Store } from "@tauri-apps/plugin-store";
import { validateSession, type SessionData } from "../lib/session-schema";

const SESSION_FILE = "session.json";
const SESSION_KEY = "session";
const SAVE_DEBOUNCE_MS = 500;

let store: Store | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = build();
    if (data === null || store === null) {
      return;
    }
    store
      .set(SESSION_KEY, data)
      .then(() => store?.save())
      .catch((err: unknown) => {
        console.warn("Failed to save session:", err);
      });
  }, SAVE_DEBOUNCE_MS);
}
