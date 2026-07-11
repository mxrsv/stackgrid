import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PaneProcessInfo } from "../lib/process-info";

/** Mirror of the Rust `AgentInfo` payload from `detect_agents`. */
export interface DetectedAgent {
  readonly name: string;
  readonly path: string;
}

/** PTY + process-info seam used by TabManager / TerminalManager / close paths. */
export interface PtyClient {
  spawnShell(opts: {
    cols: number;
    rows: number;
    cwd: string | null;
  }): Promise<number>;
  writePty(id: number, data: string): Promise<void>;
  resizePty(id: number, cols: number, rows: number): Promise<void>;
  killPty(id: number): Promise<void>;
  /** Fresh pty_info; throws on IPC failure (poll keeps last-known on catch). */
  ptyInfo(ids: readonly number[]): Promise<PaneProcessInfo[]>;
  gitBranch(cwd: string): Promise<string | null>;
  /** Agent CLIs found on the login shell's `$PATH` (allowlist order). */
  detectAgents(): Promise<DetectedAgent[]>;
  confirmQuit(): Promise<void>;
  listenOutput(
    handler: (id: number, data: string) => void,
  ): Promise<UnlistenFn>;
  listenExit(handler: (id: number) => void): Promise<UnlistenFn>;
}

interface OutputPayload {
  id: number;
  data: string;
}

interface ExitPayload {
  id: number;
}

/** Production adapter — Tauri IPC. */
export function createTauriPtyClient(): PtyClient {
  return {
    spawnShell({ cols, rows, cwd }) {
      return invoke<number>("spawn_shell", { cols, rows, cwd });
    },
    writePty(id, data) {
      return invoke("write_pty", { id, data });
    },
    resizePty(id, cols, rows) {
      return invoke("resize_pty", { id, cols, rows });
    },
    killPty(id) {
      return invoke("kill_pty", { id });
    },
    async ptyInfo(ids) {
      if (ids.length === 0) {
        return [];
      }
      return invoke<PaneProcessInfo[]>("pty_info", { ids: [...ids] });
    },
    gitBranch(cwd) {
      return invoke<string | null>("git_branch", { cwd });
    },
    detectAgents() {
      return invoke<DetectedAgent[]>("detect_agents");
    },
    confirmQuit() {
      return invoke("confirm_quit");
    },
    listenOutput(handler) {
      return listen<OutputPayload>("pty:output", (event) => {
        handler(event.payload.id, event.payload.data);
      });
    },
    listenExit(handler) {
      return listen<ExitPayload>("pty:exit", (event) => {
        handler(event.payload.id);
      });
    },
  };
}

/** In-memory adapter for unit tests — no Tauri. */
export function createMemoryPtyClient(
  options: {
    nextId?: number;
    infos?: ReadonlyMap<number, PaneProcessInfo>;
    agents?: readonly DetectedAgent[];
  } = {},
): PtyClient & {
  readonly sessions: Map<number, { cwd: string | null }>;
  emitOutput(id: number, data: string): void;
  emitExit(id: number): void;
} {
  let nextId = options.nextId ?? 1;
  const sessions = new Map<number, { cwd: string | null }>();
  const infos = new Map(options.infos ?? []);
  const outputHandlers = new Set<(id: number, data: string) => void>();
  const exitHandlers = new Set<(id: number) => void>();

  return {
    sessions,
    async spawnShell({ cwd }) {
      const id = nextId;
      nextId += 1;
      sessions.set(id, { cwd });
      return id;
    },
    async writePty() {},
    async resizePty() {},
    async killPty(id) {
      sessions.delete(id);
    },
    async ptyInfo(ids) {
      return ids.flatMap((id) => {
        const info = infos.get(id);
        return info ? [info] : [];
      });
    },
    async gitBranch() {
      return null;
    },
    async detectAgents() {
      return [...(options.agents ?? [])];
    },
    async confirmQuit() {},
    async listenOutput(handler) {
      outputHandlers.add(handler);
      return () => {
        outputHandlers.delete(handler);
      };
    },
    async listenExit(handler) {
      exitHandlers.add(handler);
      return () => {
        exitHandlers.delete(handler);
      };
    },
    emitOutput(id, data) {
      for (const handler of outputHandlers) {
        handler(id, data);
      }
    },
    emitExit(id) {
      for (const handler of exitHandlers) {
        handler(id);
      }
    },
  };
}

/** Shared production client — factories accept an override for tests. */
export const defaultPtyClient: PtyClient = createTauriPtyClient();
