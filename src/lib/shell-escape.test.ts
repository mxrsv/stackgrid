import { describe, expect, it } from "vitest";
import { shellEscapePath, shellEscapePaths } from "./shell-escape";

describe("shellEscapePath", () => {
  it("leaves a clean path untouched", () => {
    expect(shellEscapePath("/Users/me/dev/file.txt")).toBe(
      "/Users/me/dev/file.txt",
    );
  });

  it("escapes spaces", () => {
    expect(shellEscapePath("/Users/me/My File.txt")).toBe(
      "/Users/me/My\\ File.txt",
    );
  });

  it("escapes quotes, $ and &", () => {
    expect(shellEscapePath("a'b")).toBe("a\\'b");
    expect(shellEscapePath('a"b')).toBe('a\\"b');
    expect(shellEscapePath("a$b")).toBe("a\\$b");
    expect(shellEscapePath("a&b")).toBe("a\\&b");
  });

  it("escapes parentheses", () => {
    expect(shellEscapePath("a(b)c")).toBe("a\\(b\\)c");
  });

  it("keeps unicode (Vietnamese) but still escapes the space", () => {
    expect(shellEscapePath("/Users/me/Tài liệu")).toBe("/Users/me/Tài\\ liệu");
  });

  it("returns empty string for empty input", () => {
    expect(shellEscapePath("")).toBe("");
  });
});

describe("shellEscapePaths", () => {
  it("joins escaped paths with spaces and adds a trailing space", () => {
    expect(shellEscapePaths(["/a b", "/c"])).toBe("/a\\ b /c ");
  });

  it("returns empty string for an empty array", () => {
    expect(shellEscapePaths([])).toBe("");
  });
});
