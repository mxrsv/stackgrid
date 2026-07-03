import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { FONT_FALLBACK, type Settings } from "../settings/settings-schema";
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

  const termEl = document.createElement("div");
  termEl.className = "pane__term";
  element.append(bar, termEl);

  const term = new Terminal({
    cursorBlink: true,
    fontSize: initial.fontSize,
    fontFamily: toFontStack(initial.fontFamily),
    lineHeight: 1.25,
    scrollback: 10_000,
    macOptionIsMeta: true,
    theme: resolveTheme(initial),
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());

  term.onData((data) => events.onData(id, data));
  term.onResize(({ cols, rows }) => events.onResize(id, cols, rows));
  element.addEventListener("focusin", () => events.onFocus(id));
  element.addEventListener("mousedown", () => events.onFocus(id));

  const observer = new ResizeObserver(() => fit());
  let opened = false;

  function mount(): void {
    if (!opened) {
      term.open(termEl);
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
    badge.textContent = info.badge;
    badge.className = `pane__badge ${
      info.agent ? "pane__badge--agent" : "pane__badge--shell"
    }`;
  }

  function dispose(): void {
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
