import { signal } from "@preact/signals";

/** Cross-module UI intents: keymap / menu / board raise them, App renders. */
export type EditorRequest =
  | { readonly source: "board"; readonly workspace: string | null }
  | { readonly source: "live" };

export const boardOpen = signal(false);
export const saveDialogOpen = signal(false);
export const editorRequest = signal<EditorRequest | null>(null);
