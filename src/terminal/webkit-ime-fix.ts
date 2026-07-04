import type { Terminal } from "@xterm/xterm";

/**
 * Workarounds for xterm.js IME bugs in WKWebView (Tauri on macOS).
 *
 * Upstream issues:
 * - xtermjs/xterm.js#5894 — dead-key cancellation duplicates the committed
 *   char (synthetic keypress carries the commit charCode) and drops the next
 *   key (its `insertText` input event is blocked by the `_keyDownSeen` guard).
 * - xtermjs/xterm.js#5887 — IMEs that report keyCode 229 for every keystroke
 *   fire `input` before `keydown`, so the same `_keyDownSeen` guard drops
 *   every character after the first during rapid typing.
 *
 * Vietnamese input (Telex tone marks, macOS dead-key accents) hits both
 * paths. Chromium hosts (VS Code, Electron) are unaffected, which is why the
 * fix is gated to WebKit-only webviews.
 */

interface XtermCore {
  _compositionHelper?: {
    isComposing: boolean;
    _isSendingComposition: boolean;
  };
  _keyPressHandled: boolean;
  _unprocessedDeadKey: boolean;
  optionsService: { rawOptions: { screenReaderMode: boolean } };
  coreService: { triggerDataEvent(data: string, wasUserInput: boolean): void };
  cancel(ev: Event, force?: boolean): boolean | undefined;
  _inputEvent(ev: InputEvent): boolean;
}

/** True inside a WebKit webview that is not Chromium-based (WKWebView). */
export function isWebKitWebView(
  userAgent: string = navigator.userAgent,
): boolean {
  return userAgent.includes("AppleWebKit") && !userAgent.includes("Chrome");
}

function getCore(term: Terminal): XtermCore | null {
  const core = (term as unknown as { _core?: XtermCore })._core;
  if (
    !core ||
    typeof core._inputEvent !== "function" ||
    typeof core.cancel !== "function" ||
    !core.coreService ||
    !core.optionsService
  ) {
    return null;
  }
  return core;
}

/**
 * Replace `_inputEvent` so `insertText` input events emit whenever no
 * composition is active, instead of being gated on `_keyDownSeen` — the
 * guard that drops characters in both upstream bugs. `_keyPressHandled`
 * still dedupes against the keypress path, and events during an active or
 * finalizing composition are still ignored (CompositionHelper owns those).
 */
function patchInputEvent(core: XtermCore): void {
  core._inputEvent = (ev: InputEvent): boolean => {
    const helper = core._compositionHelper;
    const composing =
      helper !== undefined &&
      (helper.isComposing || helper._isSendingComposition);
    if (
      ev.data &&
      ev.inputType === "insertText" &&
      !composing &&
      !core.optionsService.rawOptions.screenReaderMode
    ) {
      if (core._keyPressHandled) {
        return false;
      }
      core._unprocessedDeadKey = false;
      core.coreService.triggerDataEvent(ev.data, true);
      core.cancel(ev);
      return true;
    }
    return false;
  };
}

/**
 * Suppress the synthetic keypress WebKit fires when a printable key cancels
 * a dead-key composition: its charCode is the *committed* dead-key char, so
 * xterm's `_keyPress` would re-emit it as a duplicate (#5894). Only
 * compositions that saw a `Dead`/`AltGraph` keydown are treated this way, so
 * layouts that type the same characters directly are unaffected.
 */
function installDeadKeyGuard(term: Terminal): void {
  const textarea = term.textarea;
  if (!textarea) {
    return;
  }

  let pendingDead = false;
  let deadKeyComposition = false;
  let commitPending = false;
  let lastCommit = "";

  textarea.addEventListener(
    "keydown",
    (ev: KeyboardEvent) => {
      if (ev.key === "Dead" || ev.key === "AltGraph") {
        pendingDead = true;
        if (ev.isComposing) {
          deadKeyComposition = true;
        }
      }
    },
    true,
  );
  textarea.addEventListener(
    "compositionstart",
    () => {
      deadKeyComposition = pendingDead;
      pendingDead = false;
      commitPending = false;
      lastCommit = "";
    },
    true,
  );
  textarea.addEventListener(
    "compositionend",
    (ev: CompositionEvent) => {
      if (deadKeyComposition) {
        commitPending = true;
        lastCommit = ev.data ?? "";
      }
      deadKeyComposition = false;
    },
    true,
  );

  term.attachCustomKeyEventHandler((ev: KeyboardEvent): boolean => {
    if (
      ev.type === "keypress" &&
      commitPending &&
      lastCommit.length === 1 &&
      ev.charCode === lastCommit.charCodeAt(0)
    ) {
      commitPending = false;
      // Returning false skips xterm's _keyPress, so the committed char is
      // not re-emitted; the real key arrives via the patched _inputEvent.
      return false;
    }
    if (ev.type === "keypress" && isInjectedText(ev.key)) {
      // Key-injecting Vietnamese IMEs (EVKey/OpenKey) replace typed letters
      // by sending backspaces plus ONE key event whose `key` holds the whole
      // replacement (e.g. "ào"). xterm's _keyPress would emit only the first
      // char (charCode) and then block the `input` event that carries the
      // full text — skip the keypress so the patched _inputEvent emits it.
      return false;
    }
    return true;
  });
}

/**
 * True for key values that are injected replacement text rather than a real
 * key: more than one character and at least one beyond ASCII (named keys
 * like "Enter"/"Dead" are pure-ASCII words, real keys are length 1).
 */
function isInjectedText(key: string): boolean {
  return [...key].length > 1 && /[^\x00-\x7f]/.test(key);
}

/**
 * Apply both WKWebView IME workarounds to a terminal. Must be called after
 * `term.open()` (the textarea has to exist). No-op when the internals this
 * patch relies on are missing (e.g. after an xterm.js upgrade).
 */
export function applyWebkitImeFix(term: Terminal): void {
  const core = getCore(term);
  if (core === null || !term.textarea) {
    console.warn(
      "webkit-ime-fix: xterm internals not found, skipping IME workaround",
    );
    return;
  }
  patchInputEvent(core);
  installDeadKeyGuard(term);
}
