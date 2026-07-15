import { describe, expect, it } from "vitest";
import { applyTabOverride, type TabView } from "./tabs-store";
import { isTabDotColor } from "../lib/tab-colors";

const base: TabView = {
  key: 1,
  process: "claude",
  name: null,
  dotColor: null,
  workspacePath: "/Users/k/dev/stackgrid",
  agentBusy: true,
};

describe("applyTabOverride", () => {
  it("returns the view unchanged without an override", () => {
    expect(applyTabOverride(base, undefined)).toBe(base);
  });

  it("merges a rename on top of the derived values", () => {
    const merged = applyTabOverride(base, { name: "backend" });
    expect(merged).toEqual({ ...base, name: "backend" });
    expect(base.name).toBeNull(); // no mutation
  });

  it("merges a dot color independently of the name", () => {
    expect(applyTabOverride(base, { dotColor: "red" })).toEqual({
      ...base,
      dotColor: "red",
    });
  });

  it("merges both when both are set", () => {
    expect(applyTabOverride(base, { name: "api", dotColor: "cyan" })).toEqual({
      ...base,
      name: "api",
      dotColor: "cyan",
    });
  });

  it("never touches workspacePath or agentBusy (not user overrides)", () => {
    const merged = applyTabOverride(base, { name: "api", dotColor: "cyan" });
    expect(merged.workspacePath).toBe("/Users/k/dev/stackgrid");
    expect(merged.agentBusy).toBe(true);
  });
});

describe("isTabDotColor", () => {
  it("accepts every preset token and rejects everything else", () => {
    expect(isTabDotColor("accent")).toBe(true);
    expect(isTabDotColor("magenta")).toBe(true);
    expect(isTabDotColor("hotpink")).toBe(false);
    expect(isTabDotColor(7)).toBe(false);
    expect(isTabDotColor(null)).toBe(false);
  });
});
