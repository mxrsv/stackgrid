import { describe, expect, it, vi } from "vitest";
import {
  createAgentNotifier,
  type AgentNotifierDeps,
  type AttentionNotification,
} from "./agent-notifier";

function makeNotification(
  overrides: Partial<AttentionNotification> = {},
): AttentionNotification {
  return {
    paneId: 1,
    revision: 1,
    kind: "completed",
    workspaceLabel: "my-workspace",
    agentLabel: "claude-code",
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AgentNotifierDeps> = {}): {
  deps: AgentNotifierDeps;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn();
  const deps: AgentNotifierDeps = {
    isEnabled: () => true,
    isWindowFocused: () => false,
    send,
    ...overrides,
  };
  return { deps, send };
}

describe("createAgentNotifier", () => {
  it("does not notify while the window is focused, even for an actionable kind", () => {
    const { deps, send } = makeDeps({ isWindowFocused: () => true });
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(makeNotification({ kind: "error" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("does not notify when agent notifications are disabled", () => {
    const { deps, send } = makeDeps({ isEnabled: () => false });
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(makeNotification({ kind: "warning" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("notifies once when actionable, backgrounded, and enabled, with copy built from label + kind", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(
      makeNotification({
        kind: "completed",
        workspaceLabel: "stackgrid",
        agentLabel: "claude-code",
      }),
    );

    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0][0];
    expect(payload.title).toContain("stackgrid");
    expect(payload.body).toContain("claude-code");
    expect(payload.body).toContain("finished");
  });

  it.each([
    ["requested", "needs attention"],
    ["warning", "warning"],
    ["error", "error"],
  ] as const)("uses the fixed phrase for kind=%s", (kind, phrase) => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(makeNotification({ kind }));

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].body).toContain(phrase);
  });

  it("falls back to a generic 'Agent' label when agentLabel is null", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(
      makeNotification({ kind: "completed", agentLabel: null }),
    );

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].body).toBe("Agent finished");
  });

  it("never notifies for the non-actionable 'none' kind", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(makeNotification({ kind: "none" }));

    expect(send).not.toHaveBeenCalled();
  });

  it("dedupes: a second call with the same (paneId, revision) does not re-fire", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);
    const n = makeNotification({ paneId: 7, revision: 3, kind: "completed" });

    notifier.maybeNotify(n);
    notifier.maybeNotify(n); // re-render / next poll / next output — same revision

    expect(send).toHaveBeenCalledOnce();
  });

  it("fires again for a higher revision on the same pane", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(
      makeNotification({ paneId: 7, revision: 3, kind: "completed" }),
    );
    notifier.maybeNotify(
      makeNotification({ paneId: 7, revision: 4, kind: "requested" }),
    );

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("a transition suppressed by an earlier gate does not consume the dedupe slot", () => {
    const send = vi.fn();
    let enabled = false;
    const deps: AgentNotifierDeps = {
      isEnabled: () => enabled,
      isWindowFocused: () => false,
      send,
    };
    const notifier = createAgentNotifier(deps);
    const n = makeNotification({ paneId: 9, revision: 1, kind: "completed" });

    notifier.maybeNotify(n); // disabled — suppressed, not recorded
    expect(send).not.toHaveBeenCalled();

    enabled = true;
    notifier.maybeNotify(n); // now eligible — same revision, should still fire

    expect(send).toHaveBeenCalledOnce();
  });

  it("prune drops dedupe state only for pruned panes; other panes stay independent", () => {
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(
      makeNotification({ paneId: 1, revision: 1, kind: "completed" }),
    );
    notifier.maybeNotify(
      makeNotification({ paneId: 2, revision: 1, kind: "completed" }),
    );
    expect(send).toHaveBeenCalledTimes(2);

    // Pane 2 is no longer live — its dedupe state is dropped. Pane 1 stays.
    notifier.prune([1]);

    // Pane 1 is untouched by the prune: same revision stays deduped.
    notifier.maybeNotify(
      makeNotification({ paneId: 1, revision: 1, kind: "completed" }),
    );
    expect(send).toHaveBeenCalledTimes(2);

    // Pane 2's dedupe was cleared by prune — a fresh pane reusing the id (or
    // a stale re-poll) is independent of pane 1 and fires again.
    notifier.maybeNotify(
      makeNotification({ paneId: 2, revision: 1, kind: "completed" }),
    );
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("never leaks raw terminal/OSC text into the notification payload", () => {
    // Red herring: a raw terminal/OSC string that must never reach `send`.
    // AttentionNotification has no field for it — this asserts the built
    // payload is composed only from workspaceLabel + agentLabel + kind.
    const rawOsc = "\x1b]9;4;1;RAW_SECRET_PROGRESS_TEXT\x07";
    const { deps, send } = makeDeps();
    const notifier = createAgentNotifier(deps);

    notifier.maybeNotify(
      makeNotification({
        kind: "warning",
        workspaceLabel: "my-workspace",
        agentLabel: "claude-code",
      }),
    );

    expect(send).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(send.mock.calls[0][0]);
    expect(serialized).not.toContain(rawOsc);
    expect(serialized).not.toContain("RAW_SECRET_PROGRESS_TEXT");
    expect(serialized).toContain("my-workspace");
    expect(serialized).toContain("claude-code");
  });
});
