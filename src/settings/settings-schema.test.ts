import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, validateSettings } from "./settings-schema";

describe("validateSettings", () => {
  it("silently drops the legacy restoreTabs field", () => {
    const validated = validateSettings({ restoreTabs: false });
    expect("restoreTabs" in validated).toBe(false);
  });

  it("silently drops the legacy sidebarPosition field", () => {
    const validated = validateSettings({ sidebarPosition: "top" });
    expect("sidebarPosition" in validated).toBe(false);
  });
});

describe("tabBarPosition", () => {
  it("defaults to left, including for settings files that predate it", () => {
    expect(DEFAULT_SETTINGS.tabBarPosition).toBe("left");
    expect(validateSettings({}).tabBarPosition).toBe("left");
  });

  it("keeps an explicit top", () => {
    expect(validateSettings({ tabBarPosition: "top" }).tabBarPosition).toBe(
      "top",
    );
  });

  it("falls back to left on an unknown value", () => {
    expect(
      validateSettings({ tabBarPosition: "diagonal" }).tabBarPosition,
    ).toBe("left");
    expect(validateSettings({ tabBarPosition: 7 }).tabBarPosition).toBe("left");
  });
});

describe("showPaneBar", () => {
  it("defaults to false", () => {
    expect(DEFAULT_SETTINGS.showPaneBar).toBe(false);
    expect(validateSettings({}).showPaneBar).toBe(false);
  });

  it("accepts a boolean and rejects other types", () => {
    expect(validateSettings({ showPaneBar: true }).showPaneBar).toBe(true);
    expect(validateSettings({ showPaneBar: "yes" }).showPaneBar).toBe(false);
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
