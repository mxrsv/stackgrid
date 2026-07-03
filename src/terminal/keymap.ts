export type ShortcutAction =
  | "split-row"
  | "split-column"
  | "close-pane"
  | "focus-next"
  | "focus-prev";

export interface KeyBinding {
  readonly key: string; // event.key đã lowercase
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
  readonly ctrl?: boolean;
  readonly action: ShortcutAction;
}

export const DEFAULT_KEYMAP: readonly KeyBinding[] = [
  { key: "d", meta: true, action: "split-row" },
  { key: "d", meta: true, shift: true, action: "split-column" },
  { key: "w", meta: true, shift: true, action: "close-pane" },
  { key: "]", meta: true, action: "focus-next" },
  { key: "[", meta: true, action: "focus-prev" },
];

/** So khớp phím chính xác cả 4 modifier; trả về action hoặc null nếu không khớp. */
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
