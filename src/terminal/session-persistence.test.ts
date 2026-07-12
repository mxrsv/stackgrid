import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionData } from "../lib/session-schema";

const getMock = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown> => undefined),
);
const setMock = vi.hoisted(() => vi.fn(async () => {}));
const saveMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => ({ get: getMock, set: setMock, save: saveMock })),
  },
}));

import {
  flushSessionSave,
  loadSession,
  scheduleSessionSave,
} from "./session-persistence";

const data: SessionData = { version: 1, activeTab: 0, tabs: [] };

describe("flushSessionSave", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    getMock.mockClear();
    setMock.mockClear();
    saveMock.mockClear();
    await loadSession();
  });

  afterEach(async () => {
    // Drain anything still scheduled so state never leaks across tests.
    await flushSessionSave();
    setMock.mockClear();
    vi.useRealTimers();
  });

  it("writes the pending snapshot immediately", async () => {
    scheduleSessionSave(() => data);
    await flushSessionSave();
    expect(setMock).toHaveBeenCalledWith("session", data);
    expect(saveMock).toHaveBeenCalled();
  });

  it("cancels the debounce timer so the snapshot is not written twice", async () => {
    scheduleSessionSave(() => data);
    await flushSessionSave();
    await vi.advanceTimersByTimeAsync(2000);
    expect(setMock).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when nothing is scheduled", async () => {
    await flushSessionSave();
    expect(setMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("skips the write when the builder returns null", async () => {
    scheduleSessionSave(() => null);
    await flushSessionSave();
    expect(setMock).not.toHaveBeenCalled();
  });
});
