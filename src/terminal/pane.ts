import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { FONT_FALLBACK, type Settings } from "../settings/settings-schema";
import { applyWebkitImeFix, isWebKitWebView } from "./webkit-ime-fix";
import { installImeTrace } from "./ime-trace";
import { resolveTheme } from "../settings/themes";
import type { PaneHeaderInfo } from "../lib/process-info";

export interface PaneEvents {
  onData(id: number, data: string): void;
  onResize(id: number, cols: number, rows: number): void;
  onFocus(id: number): void;
}

/** A terminal cell (xterm instance) bound to one PTY session by id. */
export interface Pane {
  readonly id: number;
  readonly element: HTMLElement;
  /** Call after the element is in the DOM — opens xterm and observes resize. */
  mount(): void;
  write(data: string): void;
  writeln(line: string): void;
  fit(): void;
  focus(): void;
  applySettings(next: Settings): void;
  /** Update the header bar (dot color, cwd, process badge). */
  setHeaderInfo(info: PaneHeaderInfo): void;
  dispose(): void;
}

function toFontStack(family: string): string {
  // The user may enter their own fallback list — use it verbatim then
  if (family.includes(",")) {
    return family;
  }
  return `"${family}", ${FONT_FALLBACK}`;
}

export function createPane(
  id: number,
  initial: Settings,
  events: PaneEvents,
): Pane {
  const element = document.createElement("div");
  element.className = "pane";

  const bar = document.createElement("div");
  bar.className = "pane__bar";
  const dot = document.createElement("span");
  dot.className = "pane__dot";
  const cwdEl = document.createElement("span");
  cwdEl.className = "pane__cwd";
  const badge = document.createElement("span");
  badge.className = "pane__badge pane__badge--shell";
  badge.textContent = "shell";
  bar.append(dot, cwdEl, badge);

  // Hover anchor: shown only while the pane bar is hidden (CSS-gated).
  // It is the pane-drag handle and shows the cwd; revealed when the
  // pointer enters the top ~26px of the pane.
  const anchor = document.createElement("div");
  anchor.className = "pane__anchor";
  const anchorGrip = document.createElement("span");
  anchorGrip.className = "pane__anchor-grip";
  anchorGrip.textContent = "⋮⋮";
  const anchorCwd = document.createElement("span");
  anchorCwd.className = "pane__anchor-cwd";
  anchor.append(anchorGrip, anchorCwd);

  const termEl = document.createElement("div");
  termEl.className = "pane__term";
  element.append(bar, anchor, termEl);

  const term = new Terminal({
    // Terminal.unicode is gated behind the proposed-API check in xterm 6 —
    // required for the UnicodeGraphemesAddon below.
    allowProposedApi: true,
    cursorBlink: true,
    fontSize: initial.fontSize,
    fontFamily: toFontStack(initial.fontFamily),
    lineHeight: 1.25,
    scrollback: 10_000,
    // Option must stay a character key on macOS so IMEs (Vietnamese Telex,
    // dead-key accents) can compose — `true` swallows it as Meta.
    macOptionIsMeta: false,
    theme: resolveTheme(initial),
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  // xterm core measures cell width with a Unicode 6 table and no grapheme
  // clustering, so Vietnamese combining marks (NFD "ố" = o + ◌̂ + ◌́) are
  // counted as extra columns. Claude Code / Ink measure them as a single
  // column, so the two disagree — the cursor drifts and deleted text leaves
  // ghost cells. The graphemes addon switches xterm to Unicode 15 + grapheme
  // clustering so both sides agree on width.
  term.loadAddon(new UnicodeGraphemesAddon());
  // The addon's activate() already sets this; kept explicit as documentation.
  term.unicode.activeVersion = "15-graphemes";

  term.onData((data) => events.onData(id, data));
  term.onResize(({ cols, rows }) => events.onResize(id, cols, rows));
  element.addEventListener("focusin", () => events.onFocus(id));
  element.addEventListener("mousedown", () => events.onFocus(id));

  const ANCHOR_ZONE_PX = 26;
  element.addEventListener("mousemove", (event) => {
    const top = element.getBoundingClientRect().top;
    element.classList.toggle(
      "is-anchor-zone",
      event.clientY - top < ANCHOR_ZONE_PX,
    );
  });
  element.addEventListener("mouseleave", () => {
    element.classList.remove("is-anchor-zone");
  });

  // The flex-grow transition fires ResizeObserver every frame for ~150ms;
  // debouncing here keeps fit()/resize_pty to one call after the dust
  // settles. Direct fit() calls (mount, show, applySettings) stay immediate.
  const RESIZE_DEBOUNCE_MS = 90;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new ResizeObserver(() => {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      fit();
    }, RESIZE_DEBOUNCE_MS);
  });
  let opened = false;

  function mount(): void {
    if (!opened) {
      term.open(termEl);
      if (isWebKitWebView()) {
        applyWebkitImeFix(term);
      }
      // Diagnostic keystroke tap — dev builds only, never in production
      // (it POSTs every keystroke and PTY byte to a local collector).
      if (import.meta.env.DEV) {
        installImeTrace(term);
      }
      observer.observe(termEl);
      opened = true;
    }
    fit();
  }

  function fit(): void {
    try {
      fitAddon.fit();
    } catch {
      // Element not in DOM yet or zero-sized — skip, next fit will succeed
    }
  }

  function applySettings(next: Settings): void {
    term.options.fontFamily = toFontStack(next.fontFamily);
    term.options.fontSize = next.fontSize;
    term.options.theme = resolveTheme(next);
    fit();
  }

  function setHeaderInfo(info: PaneHeaderInfo): void {
    dot.style.background = info.dotColor;
    cwdEl.textContent = info.cwd;
    anchorCwd.textContent = info.cwd;
    badge.textContent = info.badge;
    badge.className = `pane__badge ${
      info.agent ? "pane__badge--agent" : "pane__badge--shell"
    }`;
  }

  function dispose(): void {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
    }
    observer.disconnect();
    term.dispose();
    element.remove();
  }

  return {
    id,
    element,
    mount,
    write: (data) => term.write(data),
    writeln: (line) => term.writeln(line),
    fit,
    focus: () => term.focus(),
    applySettings,
    setHeaderInfo,
    dispose,
  };
}
