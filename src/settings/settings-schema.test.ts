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
