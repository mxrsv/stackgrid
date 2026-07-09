import { describe, expect, it } from "vitest";
import {
  folderName,
  formatRelativeTime,
  MAX_RECENTS,
  pushRecent,
  validateWorkspaces,
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
});

describe("validateWorkspaces", () => {
  it("returns empty data for corrupt input", () => {
    expect(validateWorkspaces(undefined)).toEqual({ version: 1, recents: [] });
    expect(validateWorkspaces({ version: 9 })).toEqual({
      version: 1,
      recents: [],
    });
  });

  it("keeps valid entries and drops junk", () => {
    const raw = {
      version: 1,
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
