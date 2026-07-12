import { describe, expect, it, vi } from "vitest";
import { createQuitFlow, type QuitFlowDeps } from "./quit-guard";

function makeDeps(overrides: Partial<QuitFlowDeps> = {}): QuitFlowDeps & {
  confirmQuit: ReturnType<typeof vi.fn>;
  flush: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
} {
  return {
    confirmQuit: vi.fn().mockResolvedValue(true),
    flush: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as QuitFlowDeps & {
    confirmQuit: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
  };
}

describe("createQuitFlow", () => {
  it("neither flushes nor quits when the busy guard declines", async () => {
    const deps = makeDeps({ confirmQuit: vi.fn().mockResolvedValue(false) });
    await createQuitFlow(deps)();
    expect(deps.flush).not.toHaveBeenCalled();
    expect(deps.quit).not.toHaveBeenCalled();
  });

  it("flushes pending saves before quitting", async () => {
    const order: string[] = [];
    const deps = makeDeps({
      flush: vi.fn(async () => {
        order.push("flush");
      }),
      quit: vi.fn(async () => {
        order.push("quit");
      }),
    });
    await createQuitFlow(deps)();
    expect(order).toEqual(["flush", "quit"]);
  });

  it("still quits when the flush fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const deps = makeDeps({
        flush: vi.fn().mockRejectedValue(new Error("disk full")),
      });
      await createQuitFlow(deps)();
      expect(deps.quit).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("drops re-entrant calls while a prompt is open", async () => {
    let release!: (ok: boolean) => void;
    const deps = makeDeps({
      confirmQuit: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            release = resolve;
          }),
      ),
    });
    const runQuit = createQuitFlow(deps);
    const first = runQuit();
    const second = runQuit();
    release(true);
    await Promise.all([first, second]);
    expect(deps.confirmQuit).toHaveBeenCalledOnce();
    expect(deps.quit).toHaveBeenCalledOnce();
  });
});
