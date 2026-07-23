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

function fakePane(id: number, events: PaneEvents): Pane {
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
      events.onFocus(id);
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
 * `onAttentionSignal` as if the pane itself raised it. */
function setup(): {
  tm: TerminalManager;
  onAttentionSignal: ReturnType<typeof vi.fn>;
  eventsById: Map<number, PaneEvents>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const pty = createMemoryPtyClient({ nextId: 1 });
  const eventsById = new Map<number, PaneEvents>();
  const createPane: CreatePaneFn = (id, _settings, events) => {
    eventsById.set(id, events);
    return fakePane(id, events);
  };
  const onAttentionSignal = vi.fn();
  const callbacks: ManagerCallbacks = {
    onLayoutChange() {},
    onAttentionSignal,
  };
  const tm = createTerminalManager(container, callbacks, pty, { createPane });
  return { tm, onAttentionSignal, eventsById };
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
