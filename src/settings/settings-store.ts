import { signal } from "@preact/signals";
import { Store } from "@tauri-apps/plugin-store";
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type Settings,
  type TerminalColors,
} from "./settings-schema";

const STORE_FILE = "settings.json";
const STORE_KEY = "settings";
const AUTOSAVE_DEBOUNCE_MS = 300;

export const settings = signal<Settings>(DEFAULT_SETTINGS);

let store: Store | null = null;

/** Đọc settings từ đĩa khi khởi động — lỗi thì dùng defaults, app vẫn chạy. */
export async function initSettings(): Promise<void> {
  try {
    store = await Store.load(STORE_FILE, { autoSave: AUTOSAVE_DEBOUNCE_MS });
    const raw = await store.get<unknown>(STORE_KEY);
    if (raw !== undefined && raw !== null) {
      settings.value = validateSettings(raw);
    }
  } catch (err) {
    console.warn("Không đọc được settings, dùng mặc định:", err);
  }
}

function persist(next: Settings): void {
  store?.set(STORE_KEY, next).catch((err: unknown) => {
    console.warn("Không lưu được settings:", err);
  });
}

export function updateSettings(patch: Partial<Settings>): void {
  const next = { ...settings.value, ...patch };
  settings.value = next;
  persist(next);
}

/** Đặt hoặc xoá (value = undefined) một màu override. */
export function updateColorOverride(
  key: keyof TerminalColors,
  value: string | undefined,
): void {
  const { [key]: _removed, ...rest } = settings.value.colorOverrides;
  const colorOverrides = value === undefined ? rest : { ...rest, [key]: value };
  updateSettings({ colorOverrides });
}

export function resetSettings(): void {
  settings.value = DEFAULT_SETTINGS;
  persist(DEFAULT_SETTINGS);
}
