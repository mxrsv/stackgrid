import { ratioEntries } from "../lib/split-tree";
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

/**
 * Write the tree's ratios into the existing DOM without rebuilding it, so
 * the flex-grow CSS transition animates. The DOM must match the tree's
 * structure at call time (every structural change renders synchronously).
 * No-op when root is null (manager not initialized) or the container is empty.
 *
 * A `.split` element has three children: [child a, divider, child b] — the
 * walk selects `:scope > .split__child` (indexes 0 and 1 of that query) to
 * skip the divider, then descends through each child's firstElementChild.
 */
export function applyRatios(
  container: HTMLElement,
  root: TreeNode | null,
): void {
  if (!root) {
    return;
  }
  const rootEl = container.firstElementChild;
  if (!rootEl) {
    return;
  }
  for (const entry of ratioEntries(root)) {
    const splitEl = resolveSplitElement(rootEl, entry.path);
    if (!splitEl) {
      continue;
    }
    const children = splitEl.querySelectorAll<HTMLElement>(
      ":scope > .split__child",
    );
    if (children.length !== 2) {
      continue;
    }
    children[0].style.flexGrow = String(entry.ratio);
    children[1].style.flexGrow = String(1 - entry.ratio);
  }
}

/** Follow an a/b path from the tree root's element to a split element. */
function resolveSplitElement(rootEl: Element, path: Path): Element | null {
  let current: Element = rootEl;
  for (const branch of path) {
    const children = current.querySelectorAll(":scope > .split__child");
    const next = children[branch === "a" ? 0 : 1]?.firstElementChild ?? null;
    if (!next) {
      return null;
    }
    current = next;
  }
  return current;
}
