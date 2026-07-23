// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatMatchCount,
  openSearchBar,
  closeSearchBar,
  pickNormalizationWinner,
} from "./search-bar";
import type { Pane, SelectionSnapshot } from "./pane";

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

describe("pickNormalizationWinner", () => {
  const at = (row: number, col: number): SelectionSnapshot => ({
    row,
    col,
    length: 4,
  });

  it("for next, prefers the non-wrapped hit when the other wrapped", () => {
    const origin = at(5, 0);
    expect(pickNormalizationWinner("next", origin, at(1, 0), at(8, 0))).toBe(
      "nfd",
    );
  });

  it("for next, prefers the earlier hit when neither wrapped", () => {
    const origin = at(5, 0);
    expect(pickNormalizationWinner("next", origin, at(10, 0), at(8, 0))).toBe(
      "nfd",
    );
  });

  it("for previous, prefers the later hit when neither wrapped", () => {
    const origin = at(5, 0);
    expect(
      pickNormalizationWinner("previous", origin, at(2, 0), at(4, 0)),
    ).toBe("nfd");
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

  function mountBar(
    findNext: (term: string) => boolean,
    options?: {
      findPrevious?: (term: string) => boolean;
      /** Selection after each successful findNext, by call index. */
      selectionsAfterFind?: Array<SelectionSnapshot | null>;
    },
  ) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let selection: SelectionSnapshot | null = null;
    let findCall = 0;
    const selections = options?.selectionsAfterFind;

    const pane = {
      id: 1,
      element: host,
      search: {
        findNext: vi.fn((term: string) => {
          const hit = findNext(term);
          if (selections) {
            selection = selections[findCall] ?? null;
            findCall += 1;
          } else if (hit) {
            selection = { col: 0, row: findCall, length: term.length };
            findCall += 1;
          } else {
            selection = null;
            findCall += 1;
          }
          return hit;
        }),
        findPrevious: vi.fn(
          (term: string) => options?.findPrevious?.(term) ?? false,
        ),
        clearDecorations: vi.fn(),
        onDidChangeResults: vi.fn(() => ({ dispose: vi.fn() })),
      },
      captureSelection: vi.fn(() => selection),
      restoreSelection: vi.fn((next: SelectionSnapshot | null) => {
        selection = next;
      }),
      focus: vi.fn(),
    } as unknown as Pane;
    openSearchBar(pane);
    return {
      input: host.querySelector("input") as HTMLInputElement,
      findNext: pane.search.findNext as unknown as ReturnType<typeof vi.fn>,
      findPrevious: pane.search.findPrevious as unknown as ReturnType<
        typeof vi.fn
      >,
      restoreSelection: pane.restoreSelection as unknown as ReturnType<
        typeof vi.fn
      >,
      nextButton: host.querySelectorAll("button")[1] as HTMLButtonElement,
    };
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("tries NFC then NFD when NFC finds nothing (macOS paths are NFD)", () => {
    const bar = mountBar((term) => term === NFD);
    type(bar.input, NFC);

    expect(bar.findNext).toHaveBeenNthCalledWith(1, NFC, expect.anything());
    expect(bar.findNext).toHaveBeenNthCalledWith(2, NFD, expect.anything());
    expect(bar.restoreSelection).toHaveBeenCalled();
  });

  it("does not search twice when the term is normalization-invariant", () => {
    const bar = mountBar(() => false);
    type(bar.input, "plain");

    expect(bar.findNext).toHaveBeenCalledTimes(1);
  });

  it("restores selection after an NFC miss so Next can leave the first NFD match", () => {
    // Buffer has three NFD-only matches. Each successful NFD find advances the
    // fake selection; an NFC miss must not wipe that origin permanently.
    const nfdRows = [0, 2, 4];
    let nfdIndex = 0;
    const bar = mountBar(
      (term) => {
        if (term === NFC) {
          return false;
        }
        if (term === NFD && nfdIndex < nfdRows.length) {
          return true;
        }
        return false;
      },
      {
        selectionsAfterFind: [
          null, // NFC miss
          { col: 0, row: 0, length: NFD.length }, // NFD → match 0
          null, // NFC miss on Next
          { col: 0, row: 2, length: NFD.length }, // NFD → match 1
        ],
      },
    );

    type(bar.input, NFC);
    // After incremental search, selection is on row 0. Press Next.
    nfdIndex = 1;
    bar.nextButton.click();

    const nfdCalls = bar.findNext.mock.calls.filter(([term]) => term === NFD);
    expect(nfdCalls.length).toBeGreaterThanOrEqual(2);
    // Origin was restored before the second NFD probe (not left cleared).
    expect(bar.restoreSelection).toHaveBeenCalled();
    expect(bar.restoreSelection.mock.calls.some(([s]) => s === null)).toBe(
      true,
    );
  });

  it("probes NFD even when NFC already matched (mixed buffer)", () => {
    const bar = mountBar((term) => term === NFC || term === NFD, {
      selectionsAfterFind: [
        { col: 0, row: 1, length: NFC.length }, // NFC hit
        { col: 0, row: 0, length: NFD.length }, // NFD hit earlier → wins
        { col: 0, row: 0, length: NFD.length }, // re-apply winner
      ],
    });
    type(bar.input, NFC);

    const terms = bar.findNext.mock.calls.map(([term]) => term);
    expect(terms).toContain(NFC);
    expect(terms).toContain(NFD);
    // Winner re-applied: last call is NFD (earlier row).
    expect(terms[terms.length - 1]).toBe(NFD);
  });
});
