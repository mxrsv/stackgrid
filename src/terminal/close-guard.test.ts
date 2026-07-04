import { describe, expect, it } from "vitest";
import { busyProcesses, confirmMessage, isBusy } from "./close-guard";
import type { PaneProcessInfo } from "../lib/process-info";

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
