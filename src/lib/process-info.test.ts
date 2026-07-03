import { describe, expect, it } from "vitest";
import { dotColor, isAgent, paneHeaderInfo, tildify } from "./process-info";

describe("dotColor", () => {
  it("maps known agents to their theme color vars", () => {
    expect(dotColor("claude")).toBe("var(--magenta)");
    expect(dotColor("codex")).toBe("var(--green)");
    expect(dotColor("gemini")).toBe("var(--cyan)");
  });

  it("falls back to the faint tone for anything else", () => {
    expect(dotColor("zsh")).toBe("var(--text-faint)");
    expect(dotColor(null)).toBe("var(--text-faint)");
    expect(dotColor("toString")).toBe("var(--text-faint)");
  });
});

describe("isAgent", () => {
  it("only recognizes the known agent names", () => {
    expect(isAgent("claude")).toBe(true);
    expect(isAgent("zsh")).toBe(false);
    expect(isAgent(null)).toBe(false);
  });
});

describe("tildify", () => {
  it("shortens paths under home", () => {
    expect(tildify("/Users/kai/dev/app", "/Users/kai")).toBe("~/dev/app");
    expect(tildify("/Users/kai", "/Users/kai")).toBe("~");
  });

  it("tolerates a trailing slash on home", () => {
    expect(tildify("/Users/kai/dev", "/Users/kai/")).toBe("~/dev");
  });

  it("leaves foreign paths and empty home untouched", () => {
    expect(tildify("/opt/tools", "/Users/kai")).toBe("/opt/tools");
    expect(tildify("/Users/kaiser/x", "/Users/kai")).toBe("/Users/kaiser/x");
    expect(tildify("/opt/tools", "")).toBe("/opt/tools");
  });
});

describe("paneHeaderInfo", () => {
  it("builds agent header info", () => {
    expect(
      paneHeaderInfo(
        { id: 1, cwd: "/Users/kai/dev", process: "claude" },
        "/Users/kai",
      ),
    ).toEqual({
      dotColor: "var(--magenta)",
      cwd: "~/dev",
      badge: "claude",
      agent: true,
    });
  });

  it("falls back to a shell badge when the process is unknown", () => {
    expect(
      paneHeaderInfo({ id: 1, cwd: null, process: null }, "/Users/kai"),
    ).toEqual({
      dotColor: "var(--text-faint)",
      cwd: "",
      badge: "shell",
      agent: false,
    });
  });
});
