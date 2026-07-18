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

describe("search term normalization", () => {
  afterEach(() => {
    closeSearchBar();
  });

  // Normalize explicitly so the forms cannot drift with the file's encoding:
  // NFC keeps the o-circumflex as one code point, NFD splits it in two.
  const NFC = "thôn".normalize("NFC");
  const NFD = NFC.normalize("NFD");

  function mountBar(findNext: (term: string) => boolean) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const pane = {
      id: 1,
      element: host,
      search: {
        findNext: vi.fn(findNext),
        findPrevious: vi.fn(() => false),
        clearDecorations: vi.fn(),
        onDidChangeResults: vi.fn(() => ({ dispose: vi.fn() })),
      },
      focus: vi.fn(),
    } as unknown as Pane;
    openSearchBar(pane);
    return {
      input: host.querySelector("input") as HTMLInputElement,
      findNext: pane.search.findNext as unknown as ReturnType<typeof vi.fn>,
    };
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("tries NFC first for an NFD input", () => {
    const bar = mountBar(() => true);
    type(bar.input, NFD);

    expect(bar.findNext).toHaveBeenCalledTimes(1);
    expect(bar.findNext).toHaveBeenCalledWith(
      NFC,
      expect.objectContaining({ incremental: true }),
    );
  });

  it("falls back to NFD when NFC finds nothing (macOS paths are NFD)", () => {
    const bar = mountBar((term) => term === NFD);
    type(bar.input, NFC);

    expect(bar.findNext).toHaveBeenNthCalledWith(1, NFC, expect.anything());
    expect(bar.findNext).toHaveBeenNthCalledWith(2, NFD, expect.anything());
  });

  it("does not search twice when the term is normalization-invariant", () => {
    const bar = mountBar(() => false);
    type(bar.input, "plain");

    expect(bar.findNext).toHaveBeenCalledTimes(1);
  });
});
