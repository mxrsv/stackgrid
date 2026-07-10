import { signal } from "@preact/signals";

/** Cross-module UI intents: keymap / menu / board raise them, App renders. */
export type EditorRequest =
  | { readonly source: "board"; readonly workspace: string | null }
  | { readonly source: "live" };

export const boardOpen = signal(false);
export const saveDialogOpen = signal(false);
export const editorRequest = signal<EditorRequest | null>(null);

/** Most recent local-storage write failure, shown by <PersistErrorBar/>.
 * Stores keep the in-memory signal as the source of truth even when the
 * disk write fails, so this exists purely to tell the user their change
 * may not survive a relaunch — it never blocks or reverts the UI state. */
export const persistError = signal<string | null>(null);

export function reportPersistError(message: string): void {
  persistError.value = message;
}
