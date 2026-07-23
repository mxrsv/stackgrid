/**
 * Pure scroll→chapter math for the tour. No DOM access, so the sticky
 * mapping stays unit-testable and can be reused by the entrance/mobile code.
 */

export const CHAPTER_COUNT = 3;

/**
 * Fraction (0..1) of the sticky track that has scrolled under the viewport
 * top. `topPx` is the track's getBoundingClientRect().top.
 */
export function trackProgress(topPx, trackHeightPx, viewportPx) {
  const scrollable = trackHeightPx - viewportPx;

  if (scrollable <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, -topPx / scrollable));
}

/** Map a 0..1 progress to a 1-based chapter index in [1, chapterCount]. */
export function chapterForProgress(progress, chapterCount = CHAPTER_COUNT) {
  const clamped = Math.min(1, Math.max(0, progress));

  return Math.min(chapterCount, Math.floor(clamped * chapterCount) + 1);
}
