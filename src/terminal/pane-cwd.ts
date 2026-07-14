/**
 * Latest known raw (non-tildified) cwd per pane.
 *
 * The link provider needs it to resolve relative paths, and it runs inside
 * xterm's hover callback — far from the pty_info poll that learns the cwd.
 * A module-level registry keyed by pane id keeps that seam out of the Pane
 * interface, the same way `search-bar` tracks its per-pane bars.
 */
const cwds = new Map<number, string | null>();

export function setPaneCwd(id: number, cwd: string | null): void {
  cwds.set(id, cwd);
}

/** Null when the pane has no known cwd yet — the shell then started in $HOME. */
export function paneCwd(id: number): string | null {
  return cwds.get(id) ?? null;
}

export function clearPaneCwd(id: number): void {
  cwds.delete(id);
}
