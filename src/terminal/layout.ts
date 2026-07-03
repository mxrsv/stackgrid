import type { LeafNode, Path, SplitNode, TreeNode } from "../lib/split-tree";

export interface LayoutContext {
  getPaneElement(paneId: number): HTMLElement | undefined;
  isActive(paneId: number): boolean;
  /** Only outline the active pane when there is more than one pane. */
  highlightActive: boolean;
  onRatioCommit(path: Path, ratio: number): void;
}

const RATIO_MIN = 0.15;
const RATIO_MAX = 0.85;

/**
 * Builds the DOM for the split tree (imperative — kept outside Preact's
 * render loop so it never touches xterm's DOM). Pane elements are moved
 * into their new slots, not recreated, so terminal content is preserved.
 */
export function renderTree(
  container: HTMLElement,
  root: TreeNode,
  ctx: LayoutContext,
): void {
  container.replaceChildren(buildNode(root, [], ctx));
}

function buildNode(
  node: TreeNode,
  path: Path,
  ctx: LayoutContext,
): HTMLElement {
  return node.kind === "leaf"
    ? buildLeaf(node, ctx)
    : buildSplit(node, path, ctx);
}

function buildLeaf(node: LeafNode, ctx: LayoutContext): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "pane-slot";
  slot.dataset.paneId = String(node.paneId);
  if (ctx.highlightActive && ctx.isActive(node.paneId)) {
    slot.classList.add("is-active");
  }
  const pane = ctx.getPaneElement(node.paneId);
  if (pane) {
    slot.appendChild(pane);
  }
  return slot;
}

function buildSplit(
  node: SplitNode,
  path: Path,
  ctx: LayoutContext,
): HTMLElement {
  const split = document.createElement("div");
  split.className = `split split--${node.dir}`;

  const first = document.createElement("div");
  first.className = "split__child";
  first.style.flexGrow = String(node.ratio);
  first.appendChild(buildNode(node.a, [...path, "a"], ctx));

  const second = document.createElement("div");
  second.className = "split__child";
  second.style.flexGrow = String(1 - node.ratio);
  second.appendChild(buildNode(node.b, [...path, "b"], ctx));

  const divider = buildDivider(node, path, { split, first, second }, ctx);

  split.append(first, divider, second);
  return split;
}

interface SplitElements {
  split: HTMLElement;
  first: HTMLElement;
  second: HTMLElement;
}

function buildDivider(
  node: SplitNode,
  path: Path,
  elements: SplitElements,
  ctx: LayoutContext,
): HTMLElement {
  const divider = document.createElement("div");
  divider.className = "split__divider";

  divider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    divider.setPointerCapture(event.pointerId);
    divider.classList.add("is-dragging");
    elements.split.classList.add("is-resizing");
    let ratio = node.ratio;

    const onMove = (moveEvent: PointerEvent): void => {
      const rect = elements.split.getBoundingClientRect();
      const position =
        node.dir === "row"
          ? (moveEvent.clientX - rect.left) / rect.width
          : (moveEvent.clientY - rect.top) / rect.height;
      ratio = Math.min(RATIO_MAX, Math.max(RATIO_MIN, position));
      elements.first.style.flexGrow = String(ratio);
      elements.second.style.flexGrow = String(1 - ratio);
    };

    const onUp = (): void => {
      divider.removeEventListener("pointermove", onMove);
      divider.classList.remove("is-dragging");
      elements.split.classList.remove("is-resizing");
      ctx.onRatioCommit(path, ratio);
    };

    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp, { once: true });
  });

  return divider;
}
