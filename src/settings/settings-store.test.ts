import { beforeEach, describe, expect, it, vi } from "vitest";

const setMock = vi.hoisted(() => vi.fn(async () => {}));
const saveMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => ({
      get: vi.fn(async (): Promise<unknown> => undefined),
      set: setMock,
      save: saveMock,
    })),
  },
}));

import {
  flushSettingsSave,
  initSettings,
  updateSettings,
} from "./settings-store";
import { persistError } from "../chrome/events";

describe("settings persistence", () => {
  beforeEach(async () => {
    setMock.mockClear();
    saveMock.mockClear();
    persistError.value = null;
    await initSettings();
  });

  it("surfaces a failed settings write to the user", async () => {
    setMock.mockRejectedValueOnce(new Error("disk full"));
    updateSettings({ fontSize: 15 });
    await vi.waitFor(() => {
      expect(persistError.value).not.toBeNull();
    });
  });

  it("flushSettingsSave forces the autosaved store to disk", async () => {
    await flushSettingsSave();
    expect(saveMock).toHaveBeenCalled();
  });
});
