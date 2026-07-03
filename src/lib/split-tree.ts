/**
 * Immutable split tree: each node is either a pane (leaf) or a binary
 * split in the row/column direction with `ratio` applied to branch `a`.
 * Every transformation returns a new tree and never mutates the old one.
 */

export type Direction = "row" | "column";
export type Branch = "a" | "b";
export type Path = readonly Branch[];

export interface LeafNode {
  readonly kind: "leaf";
  readonly paneId: number;
}

export interface SplitNode {
  readonly kind: "split";
  readonly dir: Direction;
  readonly ratio: number;
  readonly a: TreeNode;
  readonly b: TreeNode;
}

export type TreeNode = LeafNode | SplitNode;

export function leaf(paneId: number): LeafNode {
  return { kind: "leaf", paneId };
}

/** Replace leaf `targetId` with a split containing it and the new pane `newId`. */
export function splitLeaf(
  node: TreeNode,
  targetId: number,
  newId: number,
  dir: Direction,
): TreeNode {
  if (node.kind === "leaf") {
    return node.paneId === targetId
      ? { kind: "split", dir, ratio: 0.5, a: node, b: leaf(newId) }
      : node;
  }
  return {
    ...node,
    a: splitLeaf(node.a, targetId, newId, dir),
    b: splitLeaf(node.b, targetId, newId, dir),
  };
}

/** Remove a leaf — its parent split collapses into the remaining branch. Returns null when the tree becomes empty. */
export function removeLeaf(node: TreeNode, paneId: number): TreeNode | null {
  if (node.kind === "leaf") {
    return node.paneId === paneId ? null : node;
  }
  const a = removeLeaf(node.a, paneId);
  const b = removeLeaf(node.b, paneId);
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  if (a === node.a && b === node.b) {
    return node;
  }
  return { ...node, a, b };
}

/** Swap a leaf's id (used when respawning a session into the same spot). */
export function replaceLeaf(
  node: TreeNode,
  oldId: number,
  newId: number,
): TreeNode {
  if (node.kind === "leaf") {
    return node.paneId === oldId ? leaf(newId) : node;
  }
  return {
    ...node,
    a: replaceLeaf(node.a, oldId, newId),
    b: replaceLeaf(node.b, oldId, newId),
  };
}

/** Pane ids in left→right, top→bottom order. */
export function leafIds(node: TreeNode): number[] {
  return node.kind === "leaf"
    ? [node.paneId]
    : [...leafIds(node.a), ...leafIds(node.b)];
}

/** Update the ratio of the split at `path` (a/b walk from the root). */
export function setRatio(node: TreeNode, path: Path, ratio: number): TreeNode {
  if (node.kind === "leaf") {
    return node;
  }
  if (path.length === 0) {
    return { ...node, ratio };
  }
  const [head, ...rest] = path;
  return head === "a"
    ? { ...node, a: setRatio(node.a, rest, ratio) }
    : { ...node, b: setRatio(node.b, rest, ratio) };
}

export interface SerializedLeaf {
  readonly type: "leaf";
}

export interface SerializedSplit {
  readonly type: "split";
  readonly direction: Direction;
  readonly ratio: number;
  readonly first: SerializedNode;
  readonly second: SerializedNode;
}

export type SerializedNode = SerializedLeaf | SerializedSplit;

/** Structure-only snapshot for session persistence — pane ids are dropped. */
export function serializeTree(node: TreeNode): SerializedNode {
  if (node.kind === "leaf") {
    return { type: "leaf" };
  }
  return {
    type: "split",
    direction: node.dir,
    ratio: node.ratio,
    first: serializeTree(node.a),
    second: serializeTree(node.b),
  };
}

export function countLeaves(layout: SerializedNode): number {
  return layout.type === "leaf"
    ? 1
    : countLeaves(layout.first) + countLeaves(layout.second);
}

/**
 * Rebuild a tree from a serialized layout, assigning `paneIds` to leaves
 * left-to-right. `paneIds` must hold exactly `countLeaves(layout)` ids.
 */
export function treeFromLayout(
  layout: SerializedNode,
  paneIds: readonly number[],
): TreeNode {
  const [node, used] = buildFromLayout(layout, paneIds, 0);
  if (used !== paneIds.length) {
    throw new Error(`Layout has ${used} leaves but got ${paneIds.length} ids`);
  }
  return node;
}

function buildFromLayout(
  layout: SerializedNode,
  paneIds: readonly number[],
  offset: number,
): [TreeNode, number] {
  if (layout.type === "leaf") {
    const id = paneIds[offset];
    if (id === undefined) {
      throw new Error(`Layout needs more than ${paneIds.length} pane ids`);
    }
    return [leaf(id), offset + 1];
  }
  const [a, afterA] = buildFromLayout(layout.first, paneIds, offset);
  const [b, afterB] = buildFromLayout(layout.second, paneIds, afterA);
  return [
    { kind: "split", dir: layout.direction, ratio: layout.ratio, a, b },
    afterB,
  ];
}
