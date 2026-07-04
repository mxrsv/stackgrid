export type ShortcutAction =
  | "split-row"
  | "split-column"
  | "close-pane"
  | "focus-next"
  | "focus-prev"
  | "toggle-expand"
  | "new-tab"
  | "close-tab"
  | "next-tab"
  | "prev-tab"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | `select-tab-${number}`;

export interface KeyBinding {
  readonly key: string; // event.key, lowercased
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly action: ShortcutAction;
}

const TAB_SELECT_BINDINGS: readonly KeyBinding[] = Array.from(
  { length: 9 },
  (_, index): KeyBinding => ({
    key: String(index + 1),
    meta: true,
    action: `select-tab-${index + 1}`,
  }),
);

export const DEFAULT_KEYMAP: readonly KeyBinding[] = [
  { key: "d", meta: true, action: "split-row" },
  { key: "d", meta: true, shift: true, action: "split-column" },
  { key: "w", meta: true, shift: true, action: "close-pane" },
  { key: "]", meta: true, action: "focus-next" },
  { key: "[", meta: true, action: "focus-prev" },
  { key: "e", meta: true, action: "toggle-expand" },
  { key: "t", meta: true, action: "new-tab" },
  { key: "w", meta: true, action: "close-tab" },
  // On a US layout Shift+] produces "}" and Shift+[ produces "{",
  // so the bindings match the produced key, not the physical one.
  { key: "}", meta: true, shift: true, action: "next-tab" },
  { key: "{", meta: true, shift: true, action: "prev-tab" },
  // Font zoom, matching the standard macOS terminal shortcuts. Cmd+= counts
  // as zoom-in so users don't have to hold Shift for the "+" key.
  { key: "=", meta: true, action: "zoom-in" },
  { key: "+", meta: true, shift: true, action: "zoom-in" },
  { key: "-", meta: true, action: "zoom-out" },
  { key: "0", meta: true, action: "zoom-reset" },
  ...TAB_SELECT_BINDINGS,
];

/** Exact match on the key and all four modifiers; null when nothing matches. */
export function matchBinding(
  event: KeyboardEvent,
  keymap: readonly KeyBinding[] = DEFAULT_KEYMAP,
): ShortcutAction | null {
  const key = event.key.toLowerCase();
  for (const binding of keymap) {
    if (
      binding.key === key &&
      !!binding.meta === event.metaKey &&
      !!binding.shift === event.shiftKey &&
      !!binding.alt === event.altKey &&
      !!binding.ctrl === event.ctrlKey
    ) {
      return binding.action;
    }
  }
  return null;
}

/** 0-based tab index for a `select-tab-N` action, null for any other action. */
export function selectTabIndex(action: ShortcutAction): number | null {
  const match = /^select-tab-(\d+)$/.exec(action);
  return match ? Number(match[1]) - 1 : null;
}
