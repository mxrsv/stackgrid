import { signal } from "@preact/signals";

/** What the tab bar needs to render one tab. */
export interface TabView {
  /** Stable identity for list rendering (not a pane/PTY id). */
  readonly key: number;
  /** Foreground process of the tab's active pane — null until the first poll. */
  readonly process: string | null;
}

/** What the status bar needs. */
export interface StatusInfo {
  readonly branch: string | null;
  readonly cwd: string | null;
  readonly agent: string | null;
  readonly paneCount: number;
  readonly home: string;
}

export const tabViews = signal<readonly TabView[]>([]);
export const activeTabIndex = signal(0);
export const statusInfo = signal<StatusInfo>({
  branch: null,
  cwd: null,
  agent: null,
  paneCount: 1,
  home: "",
});
