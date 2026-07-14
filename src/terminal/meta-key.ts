/**
 * Whether ⌘ is currently held, shared by every pane's link provider.
 *
 * Links only underline (and only activate) under ⌘, so the decoration has to
 * follow the key while the pointer sits still — a hover event alone cannot
 * tell us that the user pressed or released ⌘ afterwards.
 */
type Listener = (held: boolean) => void;

const listeners = new Set<Listener>();
let held = false;
let installed = false;

function set(next: boolean): void {
  if (held === next) {
    return;
  }
  held = next;
  for (const listener of [...listeners]) {
    listener(held);
  }
}

function install(): void {
  if (installed || typeof window === "undefined") {
    return;
  }
  installed = true;
  // Capture phase: xterm stops propagation of keys headed for the PTY.
  window.addEventListener("keydown", (event) => set(event.metaKey), true);
  window.addEventListener("keyup", (event) => set(event.metaKey), true);
  // ⌘+Tab steals focus with ⌘ still down, so the keyup never arrives — drop
  // the held state whenever the window loses focus.
  window.addEventListener("blur", () => set(false));
}

export function isMetaHeld(): boolean {
  install();
  return held;
}

/** Reconcile from a mouse event — covers a ⌘ press that landed in another app. */
export function syncMetaHeld(next: boolean): void {
  install();
  set(next);
}

export function onMetaChange(listener: Listener): () => void {
  install();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
