// @vitest-environment jsdom
import { render } from "preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_ATTENTION_SUMMARY } from "../terminal/tabs-store";
import type { AgentAttentionSummary } from "../terminal/tabs-store";
import { WorkspaceLogo } from "./workspace-logo";

type WorkspaceLogoProps = Parameters<typeof WorkspaceLogo>[0];

function actionable(
  overrides: Partial<AgentAttentionSummary> = {},
): AgentAttentionSummary {
  return {
    kind: "error",
    actionableCount: 1,
    workingCount: 0,
    unreadCount: 0,
    ...overrides,
  };
}

describe("WorkspaceLogo", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  const mount = (props: Partial<WorkspaceLogoProps> = {}): void => {
    act(() => {
      render(
        <WorkspaceLogo
          workspacePath={null}
          label="myproj"
          pending={false}
          unread={false}
          {...props}
        />,
        host,
      );
    });
  };

  describe("no actionable attention — pending-over-unread precedence", () => {
    it("pending renders the spinner, not the unread badge", () => {
      mount({ pending: true, unread: true });
      expect(host.querySelector(".wsitem__spinner")).not.toBeNull();
      expect(host.querySelector(".wsitem__logo-badge--unread")).toBeNull();
    });

    it("unread (no pending) renders the unread badge, not the spinner", () => {
      mount({ pending: false, unread: true });
      expect(host.querySelector(".wsitem__spinner")).toBeNull();
      expect(host.querySelector(".wsitem__logo-badge--unread")).not.toBeNull();
    });

    it("neither pending nor unread renders neither overlay", () => {
      mount({ pending: false, unread: false });
      expect(host.querySelector(".wsitem__spinner")).toBeNull();
      expect(host.querySelector(".wsitem__logo-badge--unread")).toBeNull();
      expect(host.querySelector(".wsitem__logo-attn")).toBeNull();
    });

    it("an idle attention summary (actionableCount 0) leaves the pending spinner in place", () => {
      mount({
        pending: true,
        unread: false,
        attention: IDLE_ATTENTION_SUMMARY,
      });
      expect(host.querySelector(".wsitem__spinner")).not.toBeNull();
      expect(host.querySelector(".wsitem__logo-attn")).toBeNull();
    });

    it("a non-actionable 'working' attention summary (actionableCount 0) still lets unread render its badge", () => {
      mount({
        pending: false,
        unread: true,
        attention: {
          kind: "working",
          actionableCount: 0,
          workingCount: 1,
          unreadCount: 0,
        },
      });
      expect(host.querySelector(".wsitem__logo-badge--unread")).not.toBeNull();
      expect(host.querySelector(".wsitem__logo-attn")).toBeNull();
    });
  });

  describe("actionable attention outranks the overlay", () => {
    it("renders the attention mark instead of the spinner when pending is also true", () => {
      const onFocusAttention = vi.fn();
      mount({
        pending: true,
        unread: true,
        attention: actionable({ kind: "error", actionableCount: 2 }),
        onFocusAttention,
      });
      expect(host.querySelector(".wsitem__spinner")).toBeNull();
      expect(host.querySelector(".wsitem__logo-badge--unread")).toBeNull();

      const wrapper = host.querySelector(".wsitem__logo-attn");
      expect(wrapper).not.toBeNull();
      const button = wrapper?.querySelector("button");
      expect(button).not.toBeNull();
      expect(button?.className).toContain("attn-mark--error");
      expect(button?.getAttribute("aria-label")).toContain("2");
    });

    it("renders the attention mark even when neither pending nor unread is set", () => {
      mount({
        pending: false,
        unread: false,
        attention: actionable({ kind: "requested", actionableCount: 1 }),
      });
      expect(host.querySelector(".wsitem__logo-attn button")).not.toBeNull();
    });
  });

  describe("optional props omitted", () => {
    it("renders without throwing when attention and onFocusAttention are entirely omitted (pending case)", () => {
      expect(() => mount({ pending: true })).not.toThrow();
      expect(host.querySelector(".wsitem__spinner")).not.toBeNull();
    });

    it("renders without throwing when attention and onFocusAttention are entirely omitted (idle case)", () => {
      expect(() => mount()).not.toThrow();
      expect(host.querySelector(".wsitem__spinner")).toBeNull();
      expect(host.querySelector(".wsitem__logo-badge--unread")).toBeNull();
      expect(host.querySelector(".wsitem__logo-attn")).toBeNull();
    });
  });
});
