// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pane, PaneAttentionSignal, PaneEvents } from "./pane";
import type { CreatePaneFn } from "./pane-lifecycle";
import { createMemoryPtyClient } from "./pty-client";
import {
  createTerminalManager,
  type ManagerCallbacks,
  type TerminalManager,
} from "./terminal-manager";

/**
 * `emitFocusEvent` models real DOM `focusin` semantics: native `.focus()`
 * fires no event when the element already holds DOM focus. Default `true`
 * matches the common case (element not yet focused); pass `false` to
 * reproduce the already-focused-element case.
 */
function fakePane(id: number, events: PaneEvents, emitFocusEvent = true): Pane {
  const element = document.createElement("div");
  return {
    id,
    element,
    search: {} as Pane["search"],
    mount() {},
    write() {},
    writeln() {},
    fit() {},
    clear() {},
    focus() {
      if (emitFocusEvent) {
        events.onFocus(id);
      }
    },
    applySettings() {},
    setHeaderInfo() {},
    captureSelection() {
      return null;
    },
    restoreSelection() {},
    dispose() {},
  };
}

/** Builds a TerminalManager wired to a fake createPane that records the
 * PaneEvents handed to each spawned pane, so a test can invoke
 * `onAttentionSignal` as if the pane itself raised it.
 *
 * `emitFocusEvent` (default `true`) is forwarded to every spawned
 * `fakePane` — pass `false` to model a manager whose panes behave like an
 * already-DOM-focused element (native `.focus()` fires no `focusin`). */
function setup(emitFocusEvent = true): {
  tm: TerminalManager;
  container: HTMLElement;
  onAttentionSignal: ReturnType<typeof vi.fn>;
  onPaneFocus: ReturnType<typeof vi.fn>;
  eventsById: Map<number, PaneEvents>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const pty = createMemoryPtyClient({ nextId: 1 });
  const eventsById = new Map<number, PaneEvents>();
  const createPane: CreatePaneFn = (id, _settings, events) => {
    eventsById.set(id, events);
    return fakePane(id, events, emitFocusEvent);
  };
  const onAttentionSignal = vi.fn();
  const onPaneFocus = vi.fn();
  const callbacks: ManagerCallbacks = {
    onLayoutChange() {},
    onAttentionSignal,
    onPaneFocus,
  };
  const tm = createTerminalManager(container, callbacks, pty, { createPane });
  return { tm, container, onAttentionSignal, onPaneFocus, eventsById };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createTerminalManager attention signal routing", () => {
  it("routes an osc-notification signal to ManagerCallbacks.onAttentionSignal with the same pane id", async () => {
    const { tm, onAttentionSignal, eventsById } = setup();
    await tm.initFresh();
    const id = tm.activePaneId();
    expect(id).not.toBeNull();

    const signal: PaneAttentionSignal = {
      kind: "requested",
      source: "osc-notification",
    };
    eventsById.get(id!)!.onAttentionSignal?.(id!, signal);

    expect(onAttentionSignal).toHaveBeenCalledTimes(1);
    expect(onAttentionSignal).toHaveBeenCalledWith(id, signal);
  });

  it("routes a bell signal the same way", async () => {
    const { tm, onAttentionSignal, eventsById } = setup();
    await tm.initFresh();
    const id = tm.activePaneId();
    expect(id).not.toBeNull();

    const signal: PaneAttentionSignal = { kind: "requested", source: "bell" };
    eventsById.get(id!)!.onAttentionSignal?.(id!, signal);

    expect(onAttentionSignal).toHaveBeenCalledWith(id, signal);
  });

  it("does not leak a signal from one manager's pane into another manager's callback", async () => {
    const a = setup();
    const b = setup();
    await a.tm.initFresh();
    await b.tm.initFresh();

    const idA = a.tm.activePaneId();
    expect(idA).not.toBeNull();
    a.eventsById.get(idA!)!.onAttentionSignal?.(idA!, {
      kind: "requested",
      source: "bell",
    });

    expect(a.onAttentionSignal).toHaveBeenCalledTimes(1);
    expect(b.onAttentionSignal).not.toHaveBeenCalled();
  });
});

describe("createTerminalManager focusPane", () => {
  it("focuses a known pane: returns true, updates activePaneId, fires onPaneFocus once", async () => {
    const { tm, onPaneFocus } = setup();
    await tm.initFresh();
    await tm.splitActive("row");
    const [first, second] = tm.paneIds();
    expect(second).not.toBeUndefined();
    onPaneFocus.mockClear();

    const ok = tm.focusPane(first!);

    expect(ok).toBe(true);
    expect(tm.activePaneId()).toBe(first);
    expect(onPaneFocus).toHaveBeenCalledTimes(1);
    expect(onPaneFocus).toHaveBeenCalledWith(first);
  });

  it("unknown pane id is a no-op: returns false, active id unchanged, no callback", async () => {
    const { tm, onPaneFocus } = setup();
    await tm.initFresh();
    const activeBefore = tm.activePaneId();
    onPaneFocus.mockClear();

    const ok = tm.focusPane(999999);

    expect(ok).toBe(false);
    expect(tm.activePaneId()).toBe(activeBefore);
    expect(onPaneFocus).not.toHaveBeenCalled();
  });

  it("focusing a different pane while zoomed restores the layout (tmux behavior)", async () => {
    const { tm, container } = setup();
    await tm.initFresh();
    await tm.splitActive("row");
    const [first, second] = tm.paneIds();
    expect(second).not.toBeUndefined();
    // splitActive left `second` active — zoom it.
    expect(tm.activePaneId()).toBe(second);
    tm.toggleZoom();
    expect(container.classList.contains("is-zoomed")).toBe(true);

    const ok = tm.focusPane(first!);

    expect(ok).toBe(true);
    expect(container.classList.contains("is-zoomed")).toBe(false);
    expect(tm.activePaneId()).toBe(first);
  });

  it("fires onPaneFocus exactly once per focusPane call when pane.focus() DOES bubble onFocus (suppression guard prevents a double)", async () => {
    // Default fakePane routes focus() through events.onFocus — without the
    // inProgrammaticFocus guard this would double-fire: once from the
    // bubbled onFocus, once from focusPane's own deterministic ack.
    const { tm, onPaneFocus } = setup();
    await tm.initFresh();
    await tm.splitActive("row");
    const [first] = tm.paneIds();
    onPaneFocus.mockClear();

    tm.focusPane(first!);

    expect(onPaneFocus).toHaveBeenCalledTimes(1);

    // Re-focusing the already-active pane still fires exactly once — setActive
    // early-returns (idempotent) but pane.focus() still bubbles onFocus.
    onPaneFocus.mockClear();
    tm.focusPane(first!);
    expect(onPaneFocus).toHaveBeenCalledTimes(1);
  });

  it("fires onPaneFocus exactly once per focusPane call when pane.focus() does NOT bubble onFocus (already-DOM-focused pane — proves the zero-emit is fixed)", async () => {
    // emitFocusEvent: false models a pane that already holds DOM focus:
    // native .focus() is then a no-op and fires no focusin, so
    // events.onFocus never runs. Before the fix this left focusPane's
    // caller with zero acks for the target; focusPane's own deterministic
    // emit now covers it regardless.
    const { tm, onPaneFocus } = setup(false);
    await tm.initFresh();
    await tm.splitActive("row");
    const [first] = tm.paneIds();
    onPaneFocus.mockClear();

    const ok = tm.focusPane(first!);

    expect(ok).toBe(true);
    expect(tm.activePaneId()).toBe(first);
    expect(onPaneFocus).toHaveBeenCalledTimes(1);
    expect(onPaneFocus).toHaveBeenCalledWith(first);
  });
});
