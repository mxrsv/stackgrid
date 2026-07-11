import { ask } from "@tauri-apps/plugin-dialog";
import type { PaneProcessInfo } from "../lib/process-info";
import { freshPaneInfo } from "./pane-info";
import { defaultPtyClient, type PtyClient } from "./pty-client";

/**
 * Foreground process names that mean "idle shell". `pty_info` reports the
 * process-group leader's proc_name, so an idle prompt shows the shell itself.
 */
const SHELL_NAMES: ReadonlySet<string> = new Set([
  "zsh",
  "bash",
  "fish",
  "sh",
  "dash",
  "nu",
  "pwsh",
]);

/** Busy = a foreground process exists and it is not an idle shell. */
export function isBusy(info: PaneProcessInfo): boolean {
  return info.process !== null && !SHELL_NAMES.has(info.process);
}

/** Busy process names, deduplicated, in pane order. */
export function busyProcesses(infos: readonly PaneProcessInfo[]): string[] {
  const names: string[] = [];
  for (const info of infos) {
    if (
      isBusy(info) &&
      info.process !== null &&
      !names.includes(info.process)
    ) {
      names.push(info.process);
    }
  }
  return names;
}

export function confirmMessage(names: readonly string[]): string {
  return names.length === 1
    ? `${names[0]} is still running. Close anyway?`
    : `These processes are still running: ${names.join(", ")}. Close anyway?`;
}

let prompting = false;

/**
 * True when closing may proceed. Fetches fresh process info for the target
 * panes (the 2s poll can miss a just-launched process) and shows one native
 * dialog when anything is busy. Info failure → not busy (degrade contract);
 * dialog failure → false (fail safe: do not close). Re-entrant calls while a
 * prompt is open → false (mirrors quit-guard's `prompting` flag).
 */
export async function confirmClose(
  paneIds: readonly number[],
  pty: PtyClient = defaultPtyClient,
): Promise<boolean> {
  if (prompting) {
    return false;
  }
  prompting = true;
  try {
    const infos = await freshPaneInfo(paneIds, pty);
    const names = busyProcesses(infos);
    if (names.length === 0) {
      return true;
    }
    try {
      return await ask(confirmMessage(names), {
        title: "Close Terminal",
        kind: "warning",
        okLabel: "Close",
        cancelLabel: "Cancel",
      });
    } catch (err: unknown) {
      console.error("Close prompt failed:", err);
      return false;
    }
  } finally {
    prompting = false;
  }
}
