import { invoke } from "@tauri-apps/api/core";
import { openUrl as openUrlWithDefaultApp } from "@tauri-apps/plugin-opener";

/** Backend seam for terminal links — Tauri IPC in production, fakes in tests. */
export interface LinkClient {
  /**
   * Absolute path of every candidate that is an existing file, index-aligned
   * with `paths` (a candidate that is not a file comes back as null).
   */
  resolvePaths(
    cwd: string,
    paths: readonly string[],
  ): Promise<(string | null)[]>;
  /** Run the editor command through the login shell; rejects with a message. */
  openEditor(command: string): Promise<void>;
  /** Hand an http/https URL to the default browser. */
  openUrl(url: string): Promise<void>;
}

export function createTauriLinkClient(): LinkClient {
  return {
    async resolvePaths(cwd, paths) {
      if (paths.length === 0) {
        return [];
      }
      return invoke<(string | null)[]>("resolve_paths", {
        cwd,
        paths: [...paths],
      });
    },
    openEditor(command) {
      return invoke("open_editor", { command });
    },
    openUrl(url) {
      return openUrlWithDefaultApp(url);
    },
  };
}

/** In-memory adapter for unit tests — no Tauri. */
export function createMemoryLinkClient(
  options: { readonly files?: readonly string[] } = {},
): LinkClient & {
  readonly openedEditor: string[];
  readonly openedUrls: string[];
} {
  const files = new Set(options.files ?? []);
  const openedEditor: string[] = [];
  const openedUrls: string[] = [];
  return {
    openedEditor,
    openedUrls,
    async resolvePaths(cwd, paths) {
      return paths.map((path) => {
        const full = path.startsWith("/") ? path : `${cwd}/${path}`;
        return files.has(full) ? full : null;
      });
    },
    async openEditor(command) {
      openedEditor.push(command);
    },
    async openUrl(url) {
      openedUrls.push(url);
    },
  };
}

/** Shared production client — factories accept an override for tests. */
export const defaultLinkClient: LinkClient = createTauriLinkClient();
