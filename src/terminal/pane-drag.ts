import type { Edge } from "../lib/split-tree";

export interface PaneDragController {
  dispose(): void;
}

interface PaneDragOptions {
  paneCount(): number;
  onMove(sourceId: number, targetId: number, edge: Edge): void;
}

const DRAG_THRESHOLD = 5;

/**
 * Drag a pane by its header bar and dock it onto an edge of another pane.
 * A single delegated pointerdown listener lives on the tab container (which
 * survives renderTree — only its children are replaced); the ghost and the
 * drop overlay are children of document.body so a re-render mid-drag cannot
 * wipe them.
 */
export function createPaneDragController(
  container: HTMLElement,
  opts: PaneDragOptions,
): PaneDragController {
  let startX = 0;
  let startY = 0;
  let sourceId: number | null = null;
  let pointerId: number | null = null;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let target: { id: number; edge: Edge } | null = null;

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const el = event.target as HTMLElement;
    if (el.closest(".split__divider")) {
      return; // let the divider handle its own resize drag
    }
    const bar = el.closest(".pane__bar");
    if (!bar) {
      return; // only drag from the header bar, not the xterm area
    }
    if (opts.paneCount() < 2) {
      return;
    }
    const slot = bar.closest<HTMLElement>(".pane-slot");
    if (!slot) {
      return;
    }
    sourceId = Number(slot.dataset.paneId);
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    // Not dragging yet — wait for the threshold in pointermove.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown, true);
  }

  function beginDrag(): void {
    dragging = true;
    container.classList.add("is-pane-dragging");
    if (pointerId !== null) {
      try {
        container.setPointerCapture(pointerId);
      } catch {
        // pointer already released — ignore
      }
    }
    ghost = document.createElement("div");
    ghost.className = "pane-drag-ghost";
    const slot = container.querySelector<HTMLElement>(
      `.pane-slot[data-pane-id="${sourceId}"]`,
    );
    ghost.textContent =
      slot?.querySelector(".pane__cwd")?.textContent || "pane";
    overlay = document.createElement("div");
    overlay.className = "drop-overlay";
    overlay.style.display = "none";
    // ALWAYS append to body — renderTree's replaceChildren(container) would wipe them.
    document.body.append(ghost, overlay);
  }

  function moveGhost(x: number, y: number): void {
    if (ghost) {
      ghost.style.left = `${x + 12}px`;
      ghost.style.top = `${y + 12}px`;
    }
  }

  /** Nearest edge by normalized distance to all four edges (diagonal split). */
  function edgeFor(rect: DOMRect, x: number, y: number): Edge {
    const left = (x - rect.left) / rect.width;
    const right = (rect.right - x) / rect.width;
    const top = (y - rect.top) / rect.height;
    const bottom = (rect.bottom - y) / rect.height;
    const min = Math.min(left, right, top, bottom);
    if (min === left) {
      return "left";
    }
    if (min === right) {
      return "right";
    }
    if (min === top) {
      return "top";
    }
    return "bottom";
  }

  function hitTest(x: number, y: number): void {
    for (const slot of container.querySelectorAll<HTMLElement>(".pane-slot")) {
      const rect = slot.getBoundingClientRect();
      if (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      ) {
        const id = Number(slot.dataset.paneId);
        if (id === sourceId) {
          break; // hovering the source itself — no dock
        }
        target = { id, edge: edgeFor(rect, x, y) };
        showOverlay(rect, target.edge);
        return;
      }
    }
    target = null;
    hideOverlay();
  }

  function showOverlay(rect: DOMRect, edge: Edge): void {
    if (!overlay) {
      return;
    }
    let left = rect.left;
    let top = rect.top;
    let width = rect.width;
    let height = rect.height;
    if (edge === "left") {
      width = rect.width / 2;
    } else if (edge === "right") {
      left = rect.left + rect.width / 2;
      width = rect.width / 2;
    } else if (edge === "top") {
      height = rect.height / 2;
    } else {
      top = rect.top + rect.height / 2;
      height = rect.height / 2;
    }
    overlay.style.display = "block";
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;
  }

  function hideOverlay(): void {
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId) {
      return;
    }
    if (!dragging) {
      if (
        Math.abs(event.clientX - startX) < DRAG_THRESHOLD &&
        Math.abs(event.clientY - startY) < DRAG_THRESHOLD
      ) {
        return;
      }
      beginDrag();
    }
    moveGhost(event.clientX, event.clientY);
    hitTest(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== pointerId) {
      return;
    }
    const wasDragging = dragging;
    const dropTarget = target;
    const src = sourceId;
    cleanup();
    if (wasDragging && dropTarget && src !== null) {
      opts.onMove(src, dropTarget.id, dropTarget.edge);
    }
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== pointerId) {
      return;
    }
    cleanup();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && dragging) {
      event.preventDefault();
      cleanup();
    }
  }

  function cleanup(): void {
    if (pointerId !== null) {
      try {
        container.releasePointerCapture(pointerId);
      } catch {
        // never captured — ignore
      }
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKeyDown, true);
    container.classList.remove("is-pane-dragging");
    ghost?.remove();
    overlay?.remove();
    ghost = null;
    overlay = null;
    target = null;
    sourceId = null;
    pointerId = null;
    dragging = false;
  }

  container.addEventListener("pointerdown", onPointerDown);

  return {
    dispose(): void {
      container.removeEventListener("pointerdown", onPointerDown);
      cleanup();
    },
  };
}
