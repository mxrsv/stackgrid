import { describe, expect, it } from "vitest";
import { formatMatchCount } from "./search-bar";

describe("formatMatchCount", () => {
  it("formats 1-based index over count", () => {
    expect(formatMatchCount(2, 17)).toBe("3/17");
    expect(formatMatchCount(0, 1)).toBe("1/1");
  });

  it("shows 0/0 when there are no matches", () => {
    expect(formatMatchCount(-1, 0)).toBe("0/0");
  });

  it("shows only the total when the active match is untracked", () => {
    expect(formatMatchCount(-1, 17)).toBe("17");
  });
});
