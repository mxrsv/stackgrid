import { describe, expect, it } from "vitest";
import {
  CHAPTER_COUNT,
  chapterForProgress,
  trackProgress,
} from "./scroll-progress.js";

describe("trackProgress", () => {
  it("is 0 before the track scrolls under the top", () => {
    // top still positive (track below the viewport top) → clamped to 0
    expect(trackProgress(200, 3400, 800)).toBe(0);
  });

  it("is 1 once scrolled past the end", () => {
    // -top exceeds the scrollable distance (3400 - 800 = 2600)
    expect(trackProgress(-3000, 3400, 800)).toBe(1);
  });

  it("is linear in the middle", () => {
    // -top / (height - viewport) = 1300 / 2600 = 0.5
    expect(trackProgress(-1300, 3400, 800)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 when the track is not taller than the viewport", () => {
    expect(trackProgress(-10, 800, 800)).toBe(0);
  });
});

describe("chapterForProgress", () => {
  it("maps the three thirds to chapters 1..3", () => {
    expect(chapterForProgress(0)).toBe(1);
    expect(chapterForProgress(0.2)).toBe(1);
    expect(chapterForProgress(0.34)).toBe(2);
    expect(chapterForProgress(0.67)).toBe(3);
    expect(chapterForProgress(1)).toBe(3);
  });

  it("clamps out-of-range input", () => {
    expect(chapterForProgress(-5)).toBe(1);
    expect(chapterForProgress(9)).toBe(3);
  });

  it("honours a custom chapter count", () => {
    expect(chapterForProgress(0.5, 4)).toBe(3);
  });

  it("exports the default chapter count", () => {
    expect(CHAPTER_COUNT).toBe(3);
  });
});
