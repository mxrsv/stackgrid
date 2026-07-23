// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneProcessInfo } from "../lib/process-info";
import type { Pane, PaneEvents } from "./pane";
import type { CreatePaneFn } from "./pane-lifecycle";
import { createMemoryPtyClient } from "./pty-client";
import { createTabManager, type TabManager } from "./tab-manager";
import { activeTabIndex, tabViews, statusInfo } from "./tabs-store";

// init() installs the file-drop listener, which reaches into the Tauri window
// and webview. Stub them so init() can register the pty output listener the
// unread tracking hangs off of.
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: async () => 1 }),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({ onDragDropEvent: async () => () => {} }),
}));

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

const createPane: CreatePaneFn = (id, _settings, events) =>
  fakePane(id, events);

function setup(options: {
  infos?: ReadonlyMap<number, PaneProcessInfo>;
  /** Directories that still exist; omitted = every path exists. */
  dirs?: readonly string[];
}): {
  tm: TabManager;
  pty: ReturnType<typeof createMemoryPtyClient>;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const pty = createMemoryPtyClient({
    nextId: 1,
    infos: options.infos,
    ...(options.dirs !== undefined ? { dirs: options.dirs } : {}),
  });
  const tm = createTabManager(host, pty, { createPane });
  return { tm, pty };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  document.body.innerHTML = "";
  tabViews.value = [];
  activeTabIndex.value = 0;
});

describe("createTabManager materialize (through the createPane seam)", () => {
  it("spawns a tab at the given CWD", async () => {
    const { tm, pty } = setup({});

    const ok = await tm.materialize({ layout: null, cwds: ["/work"] });
    await flush();

    expect(ok).toBe(true);
    expect(tabViews.value).toHaveLength(1);
    expect(pty.sessions.get(1)?.cwd).toBe("/work");
  });

  it("splitActive spawns the new pane at the focused pane's fresh CWD", async () => {
    const infos = new Map<number, PaneProcessInfo>([
      [1, { id: 1, cwd: "/repo", process: "zsh" }],
    ]);
    const { tm, pty } = setup({ infos });
    await tm.materialize({ layout: null, cwds: [] });

    await tm.splitActive("row");

    expect(pty.sessions.size).toBe(2);
    expect(pty.sessions.get(2)?.cwd).toBe("/repo");
    expect(statusInfo.value.paneCount).toBe(2);
  });
});

describe("createTabManager agent launch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("types the chosen agent into every new pane after the launch timeout", async () => {
    const { tm, pty } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/work"], {
      workspacePath: "/work",
      agent: "claude",
    });

    await vi.advanceTimersByTimeAsync(3000);

    expect(pty.writes).toEqual([{ id: 1, data: "claude\r" }]);
    tm.dispose();
  });

  it("leaves panes as plain shells for a Shell-only choice", async () => {
    const { tm, pty } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/work"], {
      workspacePath: "/work",
      agent: null,
    });

    await vi.advanceTimersByTimeAsync(3000);

    expect(pty.writes).toEqual([]);
    tm.dispose();
  });

  it("does not re-run the agent when reopening a closed tab", async () => {
    const { tm, pty } = setup({ dirs: ["/work"] });
    await tm.openFromPreset({ type: "leaf" }, ["/work"], {
      workspacePath: "/work",
      agent: "claude",
    });
    await vi.advanceTimersByTimeAsync(3000);
    await tm.closeTab(0);
    pty.writes.length = 0;

    await tm.reopenTab();
    await vi.advanceTimersByTimeAsync(3000);

    expect(pty.writes).toEqual([]);
    tm.dispose();
  });
});

describe("createTabManager workspace identity", () => {
  it("finds a tab by its workspace and reports -1 for an unopened one", async () => {
    const { tm } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/repo/a"], {
      workspacePath: "/repo/a",
    });
    await tm.openFromPreset({ type: "leaf" }, ["/repo/b"], {
      workspacePath: "/repo/b",
    });

    expect(tm.findTabByWorkspace("/repo/a")).toBe(0);
    expect(tm.findTabByWorkspace("/repo/b")).toBe(1);
    expect(tm.findTabByWorkspace("/repo/c")).toBe(-1);
    expect(tm.activeWorkspacePath()).toBe("/repo/b");
  });

  it("dedupes across a trailing slash — the same folder is one tab", async () => {
    const { tm } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/repo/a"], {
      workspacePath: "/repo/a/",
    });

    expect(tabViews.value[0].workspacePath).toBe("/repo/a");
    expect(tm.findTabByWorkspace("/repo/a")).toBe(0);
    expect(tm.findTabByWorkspace("/repo/a/")).toBe(0);
  });

  it("never opens a second tab for a workspace that already has one", async () => {
    const { tm } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/repo/a"], {
      workspacePath: "/repo/a",
    });
    await tm.openFromPreset({ type: "leaf" }, ["/repo/b"], {
      workspacePath: "/repo/b",
    });
    // Re-open the same workspace through the deep path (bypassing app dedup) —
    // even a trailing-slash variant must focus the existing tab, not clone it.
    await tm.openFromPreset({ type: "leaf" }, ["/repo/a"], {
      workspacePath: "/repo/a/",
    });

    expect(tabViews.value).toHaveLength(2);
    expect(activeTabIndex.value).toBe(0); // focused the existing /repo/a tab
  });

  it("exposes the workspace on the tab view; a tab without one stays null", async () => {
    const { tm } = setup({});
    await tm.openFromPreset({ type: "leaf" }, ["/repo/a"], {
      workspacePath: "/repo/a",
    });
    await tm.materialize({ layout: null, cwds: [] });

    expect(tabViews.value[0].workspacePath).toBe("/repo/a");
    expect(tabViews.value[1].workspacePath).toBeNull();
  });

  it("lights agentBusy only while the agent reports it is working", async () => {
    const infos = new Map<number, PaneProcessInfo>([
      [1, { id: 1, cwd: "/repo", process: "vim" }],
      [2, { id: 2, cwd: "/repo", process: "claude" }],
      [3, { id: 3, cwd: "/other", process: "npm" }],
    ]);
    const { tm, pty } = setup({ infos });
    // Tab 0: two panes — the focused one runs vim, the background one claude.
    await tm.openFromPreset({ type: "leaf" }, ["/repo"], {
      workspacePath: "/repo",
    });
    await tm.splitActive("row");
    // Tab 1: a single pane running npm — busy, but not an agent. Opening it
    // polls again, and that poll now covers tab 0's background pane too.
    await tm.openFromPreset({ type: "leaf" }, ["/other"], {
      workspacePath: "/other",
    });
    await tm.init(); // registers the pty output listener activity feeds on
    await flush();

    // An agent sitting idle at its prompt is NOT busy — no spinner.
    expect(tabViews.value[0].agentBusy).toBe(false);

    // Claude reports busy via OSC 9;4 from tab 0's background pane.
    pty.emitOutput(2, "\x1b]9;4;3\x07");
    expect(tabViews.value[0].agentBusy).toBe(true);
    expect(tabViews.value[1].agentBusy).toBe(false);

    // The clear report ends the spinner even though output just arrived.
    pty.emitOutput(2, "done.\x1b]9;4;0\x07");
    expect(tabViews.value[0].agentBusy).toBe(false);

    // npm output never lights the spinner — not an agent.
    pty.emitOutput(3, "installing...");
    expect(tabViews.value[1].agentBusy).toBe(false);

    tm.dispose();
  });

  it("falls back to sustained output for agents without progress reports", async () => {
    vi.useFakeTimers();
    try {
      const infos = new Map<number, PaneProcessInfo>([
        [1, { id: 1, cwd: "/repo", process: "claude" }],
      ]);
      const { tm, pty } = setup({ infos });
      await tm.openFromPreset({ type: "leaf" }, ["/repo"], {
        workspacePath: "/repo",
      });
      await tm.init();
      await vi.advanceTimersByTimeAsync(0);
      expect(tabViews.value[0].agentBusy).toBe(false);

      // One isolated chunk (an idle repaint) is not work…
      pty.emitOutput(1, "streaming tokens…");
      expect(tabViews.value[0].agentBusy).toBe(false);
      // …but a sustained stream is.
      await vi.advanceTimersByTimeAsync(500);
      pty.emitOutput(1, "more tokens…");
      expect(tabViews.value[0].agentBusy).toBe(true);

      // Silence — the one-shot resync timer flips it off, no poll needed.
      await vi.advanceTimersByTimeAsync(3400);
      expect(tabViews.value[0].agentBusy).toBe(false);

      tm.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createTabManager reopen (Cmd+Shift+T)", () => {
  it("reopens a closed tab whose workspace still exists", async () => {
    const { tm } = setup({ dirs: ["/repo/alive"] });
    await tm.openFromPreset({ type: "leaf" }, ["/repo/alive"], {
      workspacePath: "/repo/alive",
    });
    await tm.materialize({ layout: null, cwds: [] });
    await tm.closeTab(0);
    expect(tabViews.value).toHaveLength(1);

    await tm.reopenTab();
    await flush();

    expect(tabViews.value).toHaveLength(2);
    expect(
      tabViews.value.some((tab) => tab.workspacePath === "/repo/alive"),
    ).toBe(true);
    tm.dispose();
  });

  it("refuses to resurrect a tab whose workspace was deleted meanwhile", async () => {
    // The folder is gone by reopen time: spawn_shell would silently land in
    // $HOME while the tab kept claiming /repo/gone.
    const { tm } = setup({ dirs: [] });
    await tm.openFromPreset({ type: "leaf" }, ["/repo/gone"], {
      workspacePath: "/repo/gone",
    });
    await tm.materialize({ layout: null, cwds: [] });
    await tm.closeTab(0);
    expect(tabViews.value).toHaveLength(1);

    await tm.reopenTab();
    await flush();

    expect(tabViews.value).toHaveLength(1); // no zombie tab
    expect(
      tabViews.value.some((tab) => tab.workspacePath === "/repo/gone"),
    ).toBe(false);
    tm.dispose();
  });
});

describe("createTabManager unread tracking", () => {
  it("lights unread for background output, never for the active tab, and clears on open", async () => {
    const { tm, pty } = setup({});
    await tm.materialize({ layout: null, cwds: ["/a"] }); // tab 0 → pane 1
    await tm.materialize({ layout: null, cwds: ["/b"] }); // tab 1 → pane 2 (active)
    await tm.init(); // registers the pty output listener

    // Output to the background tab's pane lights its badge.
    pty.emitOutput(1, "hello");
    expect(tabViews.value[0].unread).toBe(true);
    expect(tabViews.value[1].unread).toBe(false);

    // Output to the active tab's own pane never lights unread.
    pty.emitOutput(2, "world");
    expect(tabViews.value[1].unread).toBe(false);

    // Opening the background tab clears its unread badge.
    tm.selectTab(0);
    expect(tabViews.value[0].unread).toBe(false);

    tm.dispose();
  });
});

describe("createTabManager close routing", () => {
  async function threeTabs(): Promise<{
    tm: TabManager;
    pty: ReturnType<typeof createMemoryPtyClient>;
  }> {
    const { tm, pty } = setup({});
    for (let i = 0; i < 3; i += 1) {
      await tm.materialize({ layout: null, cwds: [] });
    }
    return { tm, pty };
  }

  it("closes a tab and keeps the view state consistent", async () => {
    const { tm } = await threeTabs();
    expect(tabViews.value).toHaveLength(3);

    await tm.closeTab(0);

    expect(tabViews.value).toHaveLength(2);
    expect(activeTabIndex.value).toBeLessThan(2);
  });

  it("guards concurrent closes: the second Cmd+W during the first is a no-op", async () => {
    const { tm } = await threeTabs();

    // Fire both without awaiting — the second hits the busy-prompt guard
    // while the first's fresh pty_info await is still in flight.
    await Promise.all([tm.closeTab(0), tm.closeTab(1)]);

    expect(tabViews.value).toHaveLength(2);
    // The surviving entries are still closable — indexes did not go stale.
    await tm.closeTab(0);
    expect(tabViews.value).toHaveLength(1);
  });

  it("closing the last tab requests app quit instead of leaving zero tabs", async () => {
    const { tm, pty } = setup({});
    await tm.materialize({ layout: null, cwds: [] });
    const quitSpy = vi.spyOn(pty, "confirmQuit");

    await tm.closeTab(0);

    expect(quitSpy).toHaveBeenCalledTimes(1);
  });
});
