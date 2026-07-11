import { describe, expect, it } from "vitest";
import { createMemoryPtyClient } from "./pty-client";

describe("createMemoryPtyClient", () => {
  it("assigns monotonic pane ids on spawn", async () => {
    const pty = createMemoryPtyClient({ nextId: 10 });
    expect(await pty.spawnShell({ cols: 80, rows: 24, cwd: "/a" })).toBe(10);
    expect(await pty.spawnShell({ cols: 80, rows: 24, cwd: null })).toBe(11);
    expect(pty.sessions.get(10)?.cwd).toBe("/a");
  });

  it("routes output and exit to listeners", async () => {
    const pty = createMemoryPtyClient();
    const outputs: Array<[number, string]> = [];
    const exits: number[] = [];
    const stopOut = await pty.listenOutput((id, data) => {
      outputs.push([id, data]);
    });
    const stopExit = await pty.listenExit((id) => {
      exits.push(id);
    });
    pty.emitOutput(1, "hi");
    pty.emitExit(1);
    expect(outputs).toEqual([[1, "hi"]]);
    expect(exits).toEqual([1]);
    stopOut();
    stopExit();
    pty.emitOutput(1, "ignored");
    expect(outputs).toHaveLength(1);
  });
});
