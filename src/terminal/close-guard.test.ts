import { describe, expect, it, vi } from "vitest";
import {
  busyProcesses,
  confirmClose,
  confirmMessage,
  isBusy,
} from "./close-guard";
import type { PaneProcessInfo } from "../lib/process-info";

const askMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: askMock }));

const freshPaneInfoMock = vi.hoisted(() => vi.fn());
vi.mock("./pane-info", () => ({ freshPaneInfo: freshPaneInfoMock }));

function info(id: number, process: string | null): PaneProcessInfo {
  return { id, cwd: null, process };
}

describe("isBusy", () => {
  it("treats idle shells as not busy", () => {
    for (const shell of ["zsh", "bash", "fish", "sh", "dash", "nu", "pwsh"]) {
      expect(isBusy(info(1, shell))).toBe(false);
    }
  });

  it("treats agents and other foreground processes as busy", () => {
    expect(isBusy(info(1, "claude"))).toBe(true);
    expect(isBusy(info(1, "vim"))).toBe(true);
    expect(isBusy(info(1, "npm"))).toBe(true);
  });

  it("treats a pane without a process (session-ended limbo) as not busy", () => {
    expect(isBusy(info(1, null))).toBe(false);
  });
});

describe("busyProcesses", () => {
  it("collects busy names, deduplicated, in order", () => {
    const infos = [
      info(1, "zsh"),
      info(2, "claude"),
      info(3, "vim"),
      info(4, "claude"),
      info(5, null),
    ];
    expect(busyProcesses(infos)).toEqual(["claude", "vim"]);
  });

  it("is empty when every pane is idle", () => {
    expect(busyProcesses([info(1, "zsh"), info(2, null)])).toEqual([]);
  });
});

describe("confirmClose re-entrancy", () => {
  it("rejects a second call while a prompt is open, then resets", async () => {
    freshPaneInfoMock.mockResolvedValue([info(1, "claude")]);
    let resolveAsk!: (ok: boolean) => void;
    askMock.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveAsk = resolve;
      }),
    );

    const first = confirmClose([1]);
    // Let the first call get past freshPaneInfo and open the dialog
    await Promise.resolve();
    await Promise.resolve();

    await expect(confirmClose([1])).resolves.toBe(false);
    expect(askMock).toHaveBeenCalledTimes(1);

    resolveAsk(true);
    await expect(first).resolves.toBe(true);

    // Flag resets — the next call prompts again
    askMock.mockResolvedValue(false);
    await expect(confirmClose([1])).resolves.toBe(false);
    expect(askMock).toHaveBeenCalledTimes(2);
  });
});

describe("confirmMessage", () => {
  it("names the single busy process", () => {
    expect(confirmMessage(["claude"])).toBe(
      "claude is still running. Close anyway?",
    );
  });

  it("lists multiple busy processes", () => {
    expect(confirmMessage(["claude", "vim"])).toBe(
      "These processes are still running: claude, vim. Close anyway?",
    );
  });
});
