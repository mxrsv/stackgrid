import { describe, expect, it } from "vitest";
import {
  folderName,
  formatRelativeTime,
  MAX_RECENTS,
  pushRecent,
  validateWorkspaces,
  WORKSPACES_VERSION,
} from "./workspace-recents";

const NOW = 1_800_000_000_000;

describe("pushRecent", () => {
  it("puts the newest entry first", () => {
    const one = pushRecent([], "/a", NOW);
    const two = pushRecent(one, "/b", NOW + 1);
    expect(two.map((r) => r.path)).toEqual(["/b", "/a"]);
  });

  it("dedupes by path, moving it to the front with a fresh timestamp", () => {
    const list = pushRecent(pushRecent([], "/a", NOW), "/b", NOW + 1);
    const again = pushRecent(list, "/a", NOW + 2);
    expect(again.map((r) => r.path)).toEqual(["/a", "/b"]);
    expect(again[0].lastOpenedAt).toBe(NOW + 2);
  });

  it("caps the list at MAX_RECENTS, dropping the oldest", () => {
    let list = pushRecent([], "/0", NOW);
    for (let i = 1; i <= MAX_RECENTS; i += 1) {
      list = pushRecent(list, `/${i}`, NOW + i);
    }
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list.some((r) => r.path === "/0")).toBe(false);
  });

  it("records the layout + agent combo on the entry", () => {
    const [entry] = pushRecent([], "/a", NOW, "preset-1", "claude");
    expect(entry.lastPresetId).toBe("preset-1");
    expect(entry.lastAgent).toBe("claude");
  });

  it("inherits the previous combo when re-pushed with undefined", () => {
    const first = pushRecent([], "/a", NOW, "preset-1", "codex");
    const again = pushRecent(first, "/a", NOW + 5);
    expect(again[0].lastOpenedAt).toBe(NOW + 5);
    expect(again[0].lastPresetId).toBe("preset-1");
    expect(again[0].lastAgent).toBe("codex");
  });

  it("treats agent null as an explicit Shell-only overwrite", () => {
    const first = pushRecent([], "/a", NOW, "preset-1", "claude");
    const again = pushRecent(first, "/a", NOW + 5, "preset-1", null);
    expect(again[0].lastAgent).toBeNull();
  });
});

describe("validateWorkspaces", () => {
  it("returns empty data for corrupt input", () => {
    expect(validateWorkspaces(undefined)).toEqual({
      version: WORKSPACES_VERSION,
      recents: [],
    });
    expect(validateWorkspaces({ version: 9 })).toEqual({
      version: WORKSPACES_VERSION,
      recents: [],
    });
  });

  it("keeps valid entries and drops junk", () => {
    const raw = {
      version: 2,
      recents: [
        { path: "/a", lastOpenedAt: NOW },
        { path: "", lastOpenedAt: NOW },
        { path: "/b", lastOpenedAt: "yesterday" },
        42,
      ],
    };
    expect(validateWorkspaces(raw).recents).toEqual([
      { path: "/a", lastOpenedAt: NOW },
    ]);
  });

  it("reads a v1 file, keeping entries that lack the combo fields", () => {
    const raw = { version: 1, recents: [{ path: "/a", lastOpenedAt: NOW }] };
    const data = validateWorkspaces(raw);
    expect(data.version).toBe(WORKSPACES_VERSION);
    expect(data.recents).toEqual([{ path: "/a", lastOpenedAt: NOW }]);
    expect(data.recents[0].lastPresetId).toBeUndefined();
    expect(data.recents[0].lastAgent).toBeUndefined();
  });

  it("keeps well-formed combo fields and drops malformed ones", () => {
    const raw = {
      version: 2,
      recents: [
        { path: "/a", lastOpenedAt: NOW, lastPresetId: "p1", lastAgent: null },
        { path: "/b", lastOpenedAt: NOW, lastPresetId: 7, lastAgent: "" },
      ],
    };
    const [a, b] = validateWorkspaces(raw).recents;
    expect(a).toEqual({
      path: "/a",
      lastOpenedAt: NOW,
      lastPresetId: "p1",
      lastAgent: null,
    });
    expect(b).toEqual({ path: "/b", lastOpenedAt: NOW });
  });
});

describe("display helpers", () => {
  it("folderName returns the last segment", () => {
    expect(folderName("/Users/dev/work/monorepo")).toBe("monorepo");
    expect(folderName("/")).toBe("/");
  });

  it("formatRelativeTime buckets by age", () => {
    const MIN = 60_000;
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 5 * MIN, NOW)).toBe("5m ago");
    expect(formatRelativeTime(NOW - 2 * 60 * MIN, NOW)).toBe("2h ago");
    expect(formatRelativeTime(NOW - 3 * 24 * 60 * MIN, NOW)).toBe("3d ago");
    expect(formatRelativeTime(NOW - 14 * 24 * 60 * MIN, NOW)).toBe("2w ago");
  });
});
