// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaneProcessInfo } from "../lib/process-info";
import type { Pane, PaneEvents } from "./pane";
import type { CreatePaneFn } from "./pane-lifecycle";
import { createMemoryPtyClient } from "./pty-client";
import { createTabManager, type TabManager } from "./tab-manager";
import { activeTabIndex, tabViews, statusInfo } from "./tabs-store";
import { detectedAgents, pendingPaneIds } from "../agent-picker/picker-store";

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
    dispose() {},
  };
}

const createPane: CreatePaneFn = (id, _settings, events) =>
  fakePane(id, events);

function setup(options: { infos?: ReadonlyMap<number, PaneProcessInfo> }): {
  tm: TabManager;
  pty: ReturnType<typeof createMemoryPtyClient>;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const pty = createMemoryPtyClient({ nextId: 1, infos: options.infos });
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
  pendingPaneIds.value = [];
  detectedAgents.value = [];
});

describe("createTabManager materialize (through the createPane seam)", () => {
  it("spawns a tab at the given CWD and marks its panes pending for agent pick", async () => {
    const { tm, pty } = setup({});

    const ok = await tm.materialize({
      layout: null,
      cwds: ["/work"],
      agentPick: "all-new-panes",
    });
    await flush();

    expect(ok).toBe(true);
    expect(tabViews.value).toHaveLength(1);
    expect(pty.sessions.get(1)?.cwd).toBe("/work");
    expect(pendingPaneIds.value).toContain(1);
  });

  it("splitActive spawns the new pane at the focused pane's fresh CWD", async () => {
    const infos = new Map<number, PaneProcessInfo>([
      [1, { id: 1, cwd: "/repo", process: "zsh" }],
    ]);
    const { tm, pty } = setup({ infos });
    await tm.materialize({ layout: null, cwds: [], agentPick: "none" });

    await tm.splitActive("row");

    expect(pty.sessions.size).toBe(2);
    expect(pty.sessions.get(2)?.cwd).toBe("/repo");
    expect(statusInfo.value.paneCount).toBe(2);
  });
});

describe("createTabManager close routing", () => {
  async function threeTabs(): Promise<{
    tm: TabManager;
    pty: ReturnType<typeof createMemoryPtyClient>;
  }> {
    const { tm, pty } = setup({});
    for (let i = 0; i < 3; i += 1) {
      await tm.materialize({ layout: null, cwds: [], agentPick: "none" });
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
    await tm.materialize({ layout: null, cwds: [], agentPick: "none" });
    const quitSpy = vi.spyOn(pty, "confirmQuit");

    await tm.closeTab(0);

    expect(quitSpy).toHaveBeenCalledTimes(1);
  });
});
