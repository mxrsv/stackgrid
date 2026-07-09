export const WORKSPACES_VERSION = 1;
export const MAX_RECENTS = 8;

export interface RecentWorkspace {
  readonly path: string;
  readonly lastOpenedAt: number;
}

export interface WorkspacesData {
  readonly version: number;
  readonly recents: readonly RecentWorkspace[];
}

/** Invalid envelope → empty list; invalid entries are dropped one by one. */
export function validateWorkspaces(raw: unknown): WorkspacesData {
  const empty: WorkspacesData = { version: WORKSPACES_VERSION, recents: [] };
  if (typeof raw !== "object" || raw === null) {
    return empty;
  }
  const source = raw as Record<string, unknown>;
  if (source.version !== WORKSPACES_VERSION || !Array.isArray(source.recents)) {
    return empty;
  }
  const recents: RecentWorkspace[] = [];
  for (const entry of source.recents.slice(0, MAX_RECENTS)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (
      typeof record.path === "string" &&
      record.path !== "" &&
      typeof record.lastOpenedAt === "number" &&
      Number.isFinite(record.lastOpenedAt) &&
      !recents.some((r) => r.path === record.path)
    ) {
      recents.push({ path: record.path, lastOpenedAt: record.lastOpenedAt });
    }
  }
  return { version: WORKSPACES_VERSION, recents };
}

/** Newest first; same path moves to the front (no duplicate rows — FR-003 AC-3). */
export function pushRecent(
  recents: readonly RecentWorkspace[],
  path: string,
  now: number,
): readonly RecentWorkspace[] {
  const rest = recents.filter((entry) => entry.path !== path);
  return [{ path, lastOpenedAt: now }, ...rest].slice(0, MAX_RECENTS);
}

export function folderName(path: string): string {
  const trimmed = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
  const segment = trimmed.slice(trimmed.lastIndexOf("/") + 1);
  return segment === "" ? trimmed : segment;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelativeTime(then: number, now: number): string {
  const age = Math.max(0, now - then);
  if (age < MINUTE) {
    return "just now";
  }
  if (age < HOUR) {
    return `${Math.floor(age / MINUTE)}m ago`;
  }
  if (age < DAY) {
    return `${Math.floor(age / HOUR)}h ago`;
  }
  if (age < WEEK) {
    return `${Math.floor(age / DAY)}d ago`;
  }
  return `${Math.floor(age / WEEK)}w ago`;
}
