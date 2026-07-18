// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMatchCount, openSearchBar, closeSearchBar } from "./search-bar";
import type { Pane } from "./pane";

vi.mock("../settings/settings-store", () => ({
  settings: {
    value: {
      themeId: "tokyo-night",
      colorOverrides: {},
    },
  },
}));

vi.mock("../settings/themes", () => ({
  resolveTheme: () => ({
    selectionBackground: "#33467c",
    yellow: "#e0af68",
  }),
}));

describe("formatMatchCount", () => {
  it("formats 1-based index over count", () => {
    expect(formatMatchCount(2, 17)).toBe("3/17");
    expect(formatMatchCount(0, 1)).toBe("1/1");
  });

  it("shows 0/0 when there are no matches", () => {
    expect(formatMatchCount(-1, 0)).toBe("0/0");
  });

  it("shows only the total when the active match is untracked", () => {
    expect(formatMatchCount(-1, 17)).toBe("17");
  });
});

describe("search term NFC", () => {
  afterEach(() => {
    closeSearchBar();
  });

  it("normalizes an NFD input to NFC before calling findNext", () => {
    const findNext = vi.fn();
    const findPrevious = vi.fn();
    const clearDecorations = vi.fn();
    const onDidChangeResults = vi.fn(() => ({ dispose: vi.fn() }));
    const host = document.createElement("div");
    document.body.appendChild(host);

    const pane = {
      id: 1,
      element: host,
      search: { findNext, findPrevious, clearDecorations, onDidChangeResults },
      focus: vi.fn(),
    } as unknown as Pane;

    openSearchBar(pane);
    const input = host.querySelector("input") as HTMLInputElement;
    // NFD "thôn" = t h o + ◌̂ + n
    const nfd = "tho\u0302n";
    expect(nfd.normalize("NFC")).toBe("thôn");

    input.value = nfd;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(findNext).toHaveBeenCalledWith(
      "thôn",
      expect.objectContaining({ incremental: true }),
    );
  });
});
