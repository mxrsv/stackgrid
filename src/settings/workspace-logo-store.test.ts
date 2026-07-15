import { describe, expect, it } from "vitest";
import { validateLogoMap } from "./workspace-logo-store";

describe("validateLogoMap", () => {
  it("keeps path → image data URL pairs", () => {
    const raw = {
      "/Users/k/dev/a": "data:image/png;base64,AAAA",
      "/Users/k/dev/b": "data:image/svg+xml;base64,BBBB",
    };
    expect(validateLogoMap(raw)).toEqual(raw);
  });

  it("drops non-image and malformed values", () => {
    const raw = {
      "/a": "data:image/png;base64,AAAA",
      "/b": "http://example.com/x.png",
      "/c": "data:text/plain;base64,CCCC",
      "/d": 42,
      "": "data:image/png;base64,EEEE",
    };
    expect(validateLogoMap(raw)).toEqual({
      "/a": "data:image/png;base64,AAAA",
    });
  });

  it("returns empty for non-object input", () => {
    expect(validateLogoMap(null)).toEqual({});
    expect(validateLogoMap("nope")).toEqual({});
    expect(validateLogoMap(undefined)).toEqual({});
  });
});
