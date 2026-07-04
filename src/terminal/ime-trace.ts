import type { Terminal } from "@xterm/xterm";

/**
 * TEMPORARY diagnostic tap for the Vietnamese IME bug — streams every
 * keyboard/composition/input event on the terminal plus onData output to a
 * local collector (scratchpad trace-server.py) so the real WKWebView event
 * trace can be compared against the workarounds. Remove once fixed.
 */

const ENDPOINT = "http://127.0.0.1:8792/log";
const queue: string[] = [];
let flushScheduled = false;

function log(entry: Record<string, unknown>): void {
  queue.push(JSON.stringify({ t: Date.now() % 100000, ...entry }));
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      const body = queue.splice(0).join("\n");
      fetch(ENDPOINT, { method: "POST", body }).catch(() => {
        // Collector not running — tracing is best-effort
      });
    }, 200);
  }
}

function describeKey(ev: KeyboardEvent): Record<string, unknown> {
  return {
    ev: ev.type,
    key: ev.key,
    code: ev.code,
    keyCode: ev.keyCode,
    charCode: ev.charCode,
    composing: ev.isComposing,
    alt: ev.altKey,
    prevented: ev.defaultPrevented,
  };
}

export function installImeTrace(term: Terminal): void {
  const target = term.element;
  const ta = term.textarea;
  if (!target || !ta) {
    return;
  }
  for (const type of ["keydown", "keypress", "keyup"] as const) {
    target.addEventListener(
      type,
      (ev) => log({ ...describeKey(ev as KeyboardEvent), val: ta.value }),
      true,
    );
  }
  target.addEventListener(
    "input",
    (ev) => {
      const e = ev as InputEvent;
      log({
        ev: "input",
        data: e.data,
        inputType: e.inputType,
        composed: e.composed,
        val: ta.value,
      });
    },
    true,
  );
  for (const type of [
    "compositionstart",
    "compositionupdate",
    "compositionend",
  ] as const) {
    target.addEventListener(
      type,
      (ev) =>
        log({ ev: type, data: (ev as CompositionEvent).data, val: ta.value }),
      true,
    );
  }
  term.onData((data) => log({ ev: "onData", data }));
}
