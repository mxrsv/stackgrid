import { beforeEach, describe, expect, it } from "vitest";
import {
  beginPick,
  pendingPaneIds,
  prunePending,
  resolvePane,
  skipAll,
} from "./picker-store";

beforeEach(() => {
  skipAll();
});

describe("picker store", () => {
  it("beginPick adds panes without duplicating", () => {
    beginPick([1, 2]);
    beginPick([2, 3]);
    expect(pendingPaneIds.value).toEqual([1, 2, 3]);
  });

  it("resolvePane removes exactly one pane (one-shot per pane, FR-021)", () => {
    beginPick([1, 2]);
    resolvePane(1);
    expect(pendingPaneIds.value).toEqual([2]);
    resolvePane(1); // already resolved — no-op
    expect(pendingPaneIds.value).toEqual([2]);
  });

  it("skipAll clears every pending pane (FR-024)", () => {
    beginPick([1, 2, 3]);
    resolvePane(2);
    skipAll();
    expect(pendingPaneIds.value).toEqual([]);
  });

  it("prunePending drops panes that no longer exist", () => {
    beginPick([1, 2, 3]);
    prunePending([1, 3, 99]);
    expect(pendingPaneIds.value).toEqual([1, 3]);
  });
});
