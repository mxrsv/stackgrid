import { describe, expect, it } from "vitest";
import { lastProgressState } from "./osc-progress";

describe("lastProgressState", () => {
  it("parses a BEL-terminated busy report", () => {
    expect(lastProgressState("\x1b]9;4;3\x07")).toBe(3);
  });

  it("parses an ST-terminated report with a progress value", () => {
    expect(lastProgressState("\x1b]9;4;1;42\x1b\\")).toBe(1);
  });

  it("treats a bare 9;4 with no params as clear", () => {
    expect(lastProgressState("\x1b]9;4\x07")).toBe(0);
  });

  it("returns the last state when a chunk holds several reports", () => {
    expect(lastProgressState("\x1b]9;4;3\x07 output \x1b]9;4;0\x07")).toBe(0);
  });

  it("returns null for text without any report", () => {
    expect(lastProgressState("plain output")).toBeNull();
    expect(lastProgressState("")).toBeNull();
  });

  it("ignores other OSC sequences (title, notifications)", () => {
    expect(lastProgressState("\x1b]0;my title\x07")).toBeNull();
    expect(lastProgressState("\x1b]9;a notification\x07")).toBeNull();
  });

  it("finds a report embedded in surrounding output", () => {
    expect(lastProgressState("hello\x1b]9;4;2;10\x1b\\world")).toBe(2);
  });
});
