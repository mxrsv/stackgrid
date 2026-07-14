import { describe, expect, it } from "vitest";
import {
  buildEditorCommand,
  editorTemplate,
  isEditorId,
} from "./editor-command";

describe("editorTemplate", () => {
  it("returns the preset template", () => {
    expect(editorTemplate("vscode", "")).toBe("code -g {file}:{line}:{col}");
  });

  it("returns the trimmed custom command", () => {
    expect(editorTemplate("custom", "  vim {file}  ")).toBe("vim {file}");
  });
});

describe("isEditorId", () => {
  it("accepts known ids and rejects anything else", () => {
    expect(isEditorId("zed")).toBe(true);
    expect(isEditorId("emacs")).toBe(false);
    expect(isEditorId(null)).toBe(false);
  });
});

describe("buildEditorCommand", () => {
  it("substitutes file, line and column", () => {
    expect(
      buildEditorCommand("code -g {file}:{line}:{col}", "/a/b.ts", 12, 3),
    ).toBe("code -g /a/b.ts:12:3");
  });

  it("defaults a missing line and column to 1", () => {
    expect(
      buildEditorCommand("code -g {file}:{line}:{col}", "/a/b.ts", null, null),
    ).toBe("code -g /a/b.ts:1:1");
  });

  it("escapes a path with spaces", () => {
    expect(buildEditorCommand("zed {file}", "/a b/c.ts", null, null)).toBe(
      "zed /a\\ b/c.ts",
    );
  });

  it("appends the path when the template has no placeholder", () => {
    expect(buildEditorCommand("mate", "/a/b.ts", null, null)).toBe(
      "mate /a/b.ts",
    );
  });

  it("returns null for an empty template", () => {
    expect(buildEditorCommand("   ", "/a/b.ts", 1, 1)).toBeNull();
  });
});
