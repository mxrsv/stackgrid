/**
 * Pure link detection over one logical terminal line.
 *
 * Two kinds are recognised:
 *  - `url`  — http/https, opened in the default browser
 *  - `path` — a file path, optionally suffixed `:line` or `:line:col`
 *
 * Path matching is deliberately loose (agents print bare relative paths like
 * `src/foo.ts:12`), so a candidate is only a *candidate*: the caller resolves
 * it against the pane's cwd and drops the ones that are not real files.
 */

export type LinkKind = "url" | "path";

export interface LinkCandidate {
  readonly kind: LinkKind;
  /** Exactly the text the user sees and clicks (includes any `:line:col`). */
  readonly text: string;
  /** The URL, or the path without its `:line:col` suffix. */
  readonly target: string;
  readonly line: number | null;
  readonly col: number | null;
  /** Index into the source string, inclusive. */
  readonly start: number;
  /** Index into the source string, exclusive. */
  readonly end: number;
}

/** Bounds the resolve batch a single hover can trigger. */
export const MAX_CANDIDATES_PER_LINE = 24;

// http/https up to the first whitespace or quote, minus trailing punctuation.
// Copied from @xterm/addon-web-links (strictUrlRegex) — battle-tested there.
const URL_RE =
  /(https?|HTTPS?):[/]{2}[^\s"'!*(){}|\\^<>`]*[^\s"':,.!?{}|\\^~[\]`()<>]/g;

// One path segment. Spaces are not included: an unquoted path with a space is
// ambiguous in terminal output, so it is left alone (VS Code does the same).
const SEG = String.raw`[A-Za-z0-9_.+@%~$-]+`;
// Either a slashed path (`/a/b`, `~/a`, `./a`, `src/a`) or a bare filename
// with an extension (`pane.ts`). A bare word with no dot is never a candidate.
const SLASHED = String.raw`(?:${SEG})?(?:/${SEG})+/?`;
const BARE = String.raw`${SEG}\.[A-Za-z][A-Za-z0-9]{0,9}`;
const SUFFIX = String.raw`(?::(\d+))?(?::(\d+))?`;
// The lookbehind stops matches starting mid-token (e.g. the `com/a` inside a
// URL, or the `2.1` inside `v0.2.1`).
const PATH_RE = new RegExp(
  String.raw`(?<![\w/~.$-])(${SLASHED}|${BARE})${SUFFIX}`,
  "g",
);

/** A sentence-final dot is punctuation, never part of the path. */
function trimTrailingDots(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === ".") {
    end -= 1;
  }
  return path.slice(0, end);
}

function toInt(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function matchUrls(source: string): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  URL_RE.lastIndex = 0;
  for (let m = URL_RE.exec(source); m !== null; m = URL_RE.exec(source)) {
    out.push({
      kind: "url",
      text: m[0],
      target: m[0],
      line: null,
      col: null,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

function matchPaths(source: string): LinkCandidate[] {
  const out: LinkCandidate[] = [];
  PATH_RE.lastIndex = 0;
  for (let m = PATH_RE.exec(source); m !== null; m = PATH_RE.exec(source)) {
    const line = toInt(m[2]);
    const col = toInt(m[3]);
    const rawPath = m[1] ?? "";
    // Only trim when nothing follows the path — `foo.:12` cannot occur, so a
    // trailing dot here is always sentence punctuation.
    const path = line === null ? trimTrailingDots(rawPath) : rawPath;
    if (path === "") {
      continue;
    }
    const text = m[0].slice(0, m[0].length - (rawPath.length - path.length));
    out.push({
      kind: "path",
      text,
      target: path,
      line,
      col,
      start: m.index,
      end: m.index + text.length,
    });
  }
  return out;
}

function overlaps(a: LinkCandidate, b: LinkCandidate): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * All link candidates on `source`, ordered by position and capped at `max`.
 * URLs win over paths wherever the two overlap.
 */
export function extractLinkCandidates(
  source: string,
  max: number = MAX_CANDIDATES_PER_LINE,
): LinkCandidate[] {
  const urls = matchUrls(source);
  const paths = matchPaths(source).filter(
    (path) => !urls.some((url) => overlaps(path, url)),
  );
  return [...urls, ...paths].sort((a, b) => a.start - b.start).slice(0, max);
}
