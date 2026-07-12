import { signal } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type Settings,
  type TerminalColors,
} from "./settings-schema";
import { reportPersistError } from "../chrome/events";

const STORE_FILE = "settings.json";
const STORE_KEY = "settings";
const AUTOSAVE_DEBOUNCE_MS = 300;

export const settings = signal<Settings>(DEFAULT_SETTINGS);

let store: Store | null = null;

/** Load settings from disk at startup — on failure fall back to defaults, app keeps running. */
export async function initSettings(): Promise<void> {
  try {
    store = await Store.load(STORE_FILE, {
      defaults: { [STORE_KEY]: DEFAULT_SETTINGS },
      autoSave: AUTOSAVE_DEBOUNCE_MS,
    });
    const raw = await store.get<unknown>(STORE_KEY);
    if (raw !== undefined && raw !== null) {
      settings.value = validateSettings(raw);
    }
  } catch (err) {
    console.warn("Failed to load settings, using defaults:", err);
  }
}

function persist(next: Settings): void {
  store?.set(STORE_KEY, next).catch(() => {
    reportPersistError(
      "Couldn't save settings — changes may not survive a relaunch.",
    );
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...settings.value, ...patch };
  settings.value = next;
  persist(next);
}

/** Set or remove (value = undefined) a single color override. */
export function updateColorOverride(
  key: keyof TerminalColors,
  value: string | undefined,
): void {
  const { [key]: _removed, ...rest } = settings.value.colorOverrides;
  const colorOverrides = value === undefined ? rest : { ...rest, [key]: value };
  updateSettings({ colorOverrides });
}

/**
 * Forces the plugin-store's debounced autosave to disk — quit paths call
 * this so a just-changed setting survives the process exiting within the
 * autosave window.
 */
export async function flushSettingsSave(): Promise<void> {
  await store?.save();
}

export function resetSettings(): void {
  settings.value = DEFAULT_SETTINGS;
  persist(DEFAULT_SETTINGS);
}
