import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryPtyClient } from "./pty-client";
import { AGENT_LAUNCH_TIMEOUT_MS, createAgentLauncher } from "./agent-launch";

function setup() {
  const pty = createMemoryPtyClient();
  const launcher = createAgentLauncher(pty);
  return { pty, launcher };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAgentLauncher", () => {
  it("types the agent once the pane emits its first output", () => {
    const { pty, launcher } = setup();
    launcher.arm([1], "claude");
    expect(pty.writes).toEqual([]);

    launcher.noteOutput(1);

    expect(pty.writes).toEqual([{ id: 1, data: "claude\r" }]);
  });

  it("fires on the 3s timeout when a pane stays silent", () => {
    const { pty, launcher } = setup();
    launcher.arm([1], "codex");

    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);

    expect(pty.writes).toEqual([{ id: 1, data: "codex\r" }]);
  });

  it("types each pane exactly once even after later output", () => {
    const { pty, launcher } = setup();
    launcher.arm([1], "claude");
    launcher.noteOutput(1);
    launcher.noteOutput(1);
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);

    expect(pty.writes).toEqual([{ id: 1, data: "claude\r" }]);
  });

  it("types once when output arrives only after the timeout already fired", () => {
    const { pty, launcher } = setup();
    launcher.arm([1], "claude");
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);
    launcher.noteOutput(1);

    expect(pty.writes).toEqual([{ id: 1, data: "claude\r" }]);
  });

  it("never types anything for a Shell-only choice", () => {
    const { pty, launcher } = setup();
    launcher.arm([1, 2], null);
    launcher.noteOutput(1);
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);

    expect(pty.writes).toEqual([]);
  });

  it("fires immediately when output was already seen before arm", () => {
    const { pty, launcher } = setup();
    launcher.noteOutput(1);
    launcher.arm([1], "gemini");

    expect(pty.writes).toEqual([{ id: 1, data: "gemini\r" }]);
  });

  it("arms every pane in the list independently", () => {
    const { pty, launcher } = setup();
    launcher.arm([1, 2, 3], "claude");
    launcher.noteOutput(2);
    expect(pty.writes).toEqual([{ id: 2, data: "claude\r" }]);
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);
    expect(pty.writes).toEqual([
      { id: 2, data: "claude\r" },
      { id: 1, data: "claude\r" },
      { id: 3, data: "claude\r" },
    ]);
  });

  it("prune cancels a pending pane's timer", () => {
    const { pty, launcher } = setup();
    launcher.arm([1], "claude");
    launcher.prune([]);
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);
    launcher.noteOutput(1);

    expect(pty.writes).toEqual([]);
  });

  it("dispose cancels every pending pane", () => {
    const { pty, launcher } = setup();
    launcher.arm([1, 2], "claude");
    launcher.dispose();
    vi.advanceTimersByTime(AGENT_LAUNCH_TIMEOUT_MS);

    expect(pty.writes).toEqual([]);
  });
});
