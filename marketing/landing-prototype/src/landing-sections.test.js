import { describe, expect, it } from "vitest";
import { messages } from "./sections-copy.js";

function allValues(locale) {
  return Object.values(messages[locale]);
}

describe("sections-copy", () => {
  it("EN and VI share the same key set", () => {
    expect(Object.keys(messages.en).sort()).toEqual(
      Object.keys(messages.vi).sort(),
    );
  });

  it("does not contain deprecated 45-sec or Macos typos", () => {
    for (const locale of ["en", "vi"]) {
      for (const value of allValues(locale)) {
        expect(value).not.toContain("45-sec");
        expect(value).not.toContain("Macos");
      }
    }
  });
});
