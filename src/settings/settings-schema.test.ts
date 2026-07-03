import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, validateSettings } from "./settings-schema";

describe("validateSettings", () => {
  it("defaults restoreTabs to true", () => {
    expect(DEFAULT_SETTINGS.restoreTabs).toBe(true);
    expect(validateSettings({}).restoreTabs).toBe(true);
    expect(validateSettings({ restoreTabs: "x" }).restoreTabs).toBe(true);
  });

  it("keeps an explicit restoreTabs=false", () => {
    expect(validateSettings({ restoreTabs: false }).restoreTabs).toBe(false);
  });

  it("silently drops the legacy sidebarPosition field", () => {
    const validated = validateSettings({ sidebarPosition: "top" });
    expect("sidebarPosition" in validated).toBe(false);
  });
});

describe("focusExpand", () => {
  it("defaults to false", () => {
    expect(DEFAULT_SETTINGS.focusExpand).toBe(false);
  });

  it("accepts a valid boolean", () => {
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, focusExpand: true }).focusExpand,
    ).toBe(true);
  });

  it("falls back to false when missing or not a boolean", () => {
    expect(validateSettings({}).focusExpand).toBe(false);
    expect(
      validateSettings({ ...DEFAULT_SETTINGS, focusExpand: "yes" }).focusExpand,
    ).toBe(false);
  });
});
