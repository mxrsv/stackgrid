import { describe, expect, it } from "vitest";
import {
  countLeaves,
  leaf,
  leafIds,
  movePane,
  serializeTree,
  splitLeaf,
  treeFromLayout,
  type SerializedNode,
} from "./split-tree";

describe("serializeTree", () => {
  it("drops pane ids and keeps structure + ratios", () => {
    let tree = splitLeaf(leaf(1), 1, 2, "row");
    tree = splitLeaf(tree, 2, 3, "column");
    expect(serializeTree(tree)).toEqual({
      type: "split",
      direction: "row",
      ratio: 0.5,
      first: { type: "leaf" },
      second: {
        type: "split",
        direction: "column",
        ratio: 0.5,
        first: { type: "leaf" },
        second: { type: "leaf" },
      },
    });
  });
});

describe("treeFromLayout", () => {
  const layout: SerializedNode = {
    type: "split",
    direction: "row",
    ratio: 0.3,
    first: { type: "leaf" },
    second: {
      type: "split",
      direction: "column",
      ratio: 0.7,
      first: { type: "leaf" },
      second: { type: "leaf" },
    },
  };

  it("assigns pane ids to leaves left-to-right", () => {
    const tree = treeFromLayout(layout, [10, 20, 30]);
    expect(leafIds(tree)).toEqual([10, 20, 30]);
  });

  it("round-trips through serializeTree, preserving ratios", () => {
    expect(serializeTree(treeFromLayout(layout, [1, 2, 3]))).toEqual(layout);
  });

  it("throws when the id count does not match the leaf count", () => {
    expect(() => treeFromLayout(layout, [1, 2])).toThrow();
    expect(() => treeFromLayout(layout, [1, 2, 3, 4])).toThrow();
  });
});

describe("movePane", () => {
  // Two panes side by side in a row: { split row, a: leaf 1, b: leaf 2 }
  const twoRow = splitLeaf(leaf(1), 1, 2, "row");

  it("docks source to the LEFT of target → row, source in branch a", () => {
    expect(movePane(twoRow, 1, 2, "left")).toEqual({
      kind: "split",
      dir: "row",
      ratio: 0.5,
      a: leaf(1),
      b: leaf(2),
    });
  });

  it("docks source to the RIGHT of target → row, source in branch b", () => {
    expect(movePane(twoRow, 1, 2, "right")).toEqual({
      kind: "split",
      dir: "row",
      ratio: 0.5,
      a: leaf(2),
      b: leaf(1),
    });
  });

  it("docks source to the TOP of target → column, source in branch a", () => {
    expect(movePane(twoRow, 1, 2, "top")).toEqual({
      kind: "split",
      dir: "column",
      ratio: 0.5,
      a: leaf(1),
      b: leaf(2),
    });
  });

  it("docks source to the BOTTOM of target → column, source in branch b", () => {
    expect(movePane(twoRow, 1, 2, "bottom")).toEqual({
      kind: "split",
      dir: "column",
      ratio: 0.5,
      a: leaf(2),
      b: leaf(1),
    });
  });

  it("collapses the source's parent split after removal", () => {
    // row( leaf 1, column( leaf 2, leaf 3 ) )
    let tree = splitLeaf(leaf(1), 1, 2, "row");
    tree = splitLeaf(tree, 2, 3, "column");
    // Removing leaf 1 collapses the outer row into column(2,3); dock 1 to the right of 3.
    expect(movePane(tree, 1, 3, "right")).toEqual({
      kind: "split",
      dir: "column",
      ratio: 0.5,
      a: leaf(2),
      b: {
        kind: "split",
        dir: "row",
        ratio: 0.5,
        a: leaf(3),
        b: leaf(1),
      },
    });
  });

  it("returns the same tree reference when source === target", () => {
    expect(movePane(twoRow, 1, 1, "left")).toBe(twoRow);
  });

  it("returns the same tree reference when an id is not in the tree", () => {
    expect(movePane(twoRow, 99, 2, "left")).toBe(twoRow);
    expect(movePane(twoRow, 1, 99, "left")).toBe(twoRow);
  });

  it("does not mutate the original tree", () => {
    const snapshot = JSON.parse(JSON.stringify(twoRow));
    movePane(twoRow, 1, 2, "bottom");
    expect(twoRow).toEqual(snapshot);
  });
});

describe("countLeaves", () => {
  it("counts leaves of nested layouts", () => {
    expect(countLeaves({ type: "leaf" })).toBe(1);
    expect(
      countLeaves({
        type: "split",
        direction: "row",
        ratio: 0.5,
        first: { type: "leaf" },
        second: { type: "leaf" },
      }),
    ).toBe(2);
  });
});
