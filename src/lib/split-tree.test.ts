import { describe, expect, it } from "vitest";
import {
  countLeaves,
  leaf,
  leafIds,
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
