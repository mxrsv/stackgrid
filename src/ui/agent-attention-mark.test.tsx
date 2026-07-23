// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentAttentionSummary } from "../terminal/tabs-store";
import { AgentAttentionMark } from "./agent-attention-mark";

function summary(
  overrides: Partial<AgentAttentionSummary>,
): AgentAttentionSummary {
  return {
    kind: "idle",
    actionableCount: 0,
    workingCount: 0,
    unreadCount: 0,
    ...overrides,
  };
}

describe("AgentAttentionMark", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  const mount = (
    partial: Partial<AgentAttentionSummary>,
    onActivate?: () => void,
    label = "myproj",
  ): void => {
    act(() => {
      render(
        <AgentAttentionMark
          summary={summary(partial)}
          label={label}
          onActivate={onActivate}
        />,
        host,
      );
    });
  };

  it("renders nothing for idle", () => {
    mount({ kind: "idle" });
    expect(host.innerHTML).toBe("");
  });

  it("renders an interactive button for each actionable kind", () => {
    const kinds = ["error", "warning", "requested", "completed"] as const;
    for (const kind of kinds) {
      mount({ kind, actionableCount: 1 });
      const button = host.querySelector("button");
      expect(button).not.toBeNull();
      expect(button?.className).toContain(`attn-mark--${kind}`);
    }
  });

  it("renders a spinner status (no button) for working", () => {
    mount({ kind: "working", workingCount: 1 });
    expect(host.querySelector("button")).toBeNull();
    const status = host.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.querySelector("svg")).not.toBeNull();
  });

  it("renders a dot status (no button) for unread", () => {
    mount({ kind: "unread", unreadCount: 1 });
    expect(host.querySelector("button")).toBeNull();
    const status = host.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.querySelector(".attn-mark__dot")).not.toBeNull();
  });

  it("shows the actionable count, including two-digit counts", () => {
    mount({ kind: "error", actionableCount: 2 });
    let button = host.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toContain("2");
    expect(button.getAttribute("aria-label")).toContain("2");

    mount({ kind: "error", actionableCount: 12 });
    button = host.querySelector("button") as HTMLButtonElement;
    expect(button.textContent).toContain("12");
    expect(button.getAttribute("aria-label")).toContain("12");
  });

  it("calls onActivate exactly once when an actionable mark is clicked", () => {
    const onActivate = vi.fn();
    mount({ kind: "requested", actionableCount: 1 }, onActivate);
    const button = host.querySelector("button") as HTMLButtonElement;

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("has no button to click for working or unread — clicking is impossible", () => {
    const onActivate = vi.fn();
    mount({ kind: "working", workingCount: 1 }, onActivate);
    expect(host.querySelector("button")).toBeNull();

    mount({ kind: "unread", unreadCount: 1 }, onActivate);
    expect(host.querySelector("button")).toBeNull();

    expect(onActivate).not.toHaveBeenCalled();
  });

  it("gives the actionable mark an accessible name with workspace label, kind, and count", () => {
    mount({ kind: "warning", actionableCount: 3 }, undefined, "backend-api");
    const button = host.querySelector("button") as HTMLButtonElement;
    const name = button.getAttribute("aria-label") ?? "";

    expect(name).toContain("backend-api");
    expect(name).toContain("warning");
    expect(name).toContain("3");
  });
});
