/** Mirror of the `PtyInfo` payload returned by the Rust `pty_info` command. */
export interface PaneProcessInfo {
  readonly id: number;
  readonly cwd: string | null;
  readonly process: string | null;
}

/** Display-ready strings for a pane header bar. */
export interface PaneHeaderInfo {
  readonly dotColor: string;
  readonly cwd: string;
  readonly badge: string;
  readonly agent: boolean;
}

const AGENT_DOT_VARS: Readonly<Record<string, string>> = {
  claude: "var(--magenta)",
  codex: "var(--green)",
  gemini: "var(--cyan)",
};

function agentColor(process: string | null): string | undefined {
  if (
    process === null ||
    !Object.prototype.hasOwnProperty.call(AGENT_DOT_VARS, process)
  ) {
    return undefined;
  }
  return AGENT_DOT_VARS[process];
}

export function isAgent(process: string | null): boolean {
  return agentColor(process) !== undefined;
}

export function dotColor(process: string | null): string {
  return agentColor(process) ?? "var(--text-faint)";
}

/** Replace the home prefix with `~` for display. */
export function tildify(path: string, home: string): string {
  if (home === "") {
    return path;
  }
  const root = home.endsWith("/") ? home.slice(0, -1) : home;
  if (path === root) {
    return "~";
  }
  return path.startsWith(`${root}/`) ? `~${path.slice(root.length)}` : path;
}

export function paneHeaderInfo(
  info: PaneProcessInfo,
  home: string,
): PaneHeaderInfo {
  return {
    dotColor: dotColor(info.process),
    cwd: info.cwd === null ? "" : tildify(info.cwd, home),
    badge: info.process ?? "shell",
    agent: isAgent(info.process),
  };
}
