import { resolveLocale } from "./copy.js";

export const DIRECTIONS = ["A", "B", "C", "D", "E"];

export function readReviewState(location) {
  const url = new URL(location.href);
  const requestedDirection = url.searchParams.get("direction");
  const direction = DIRECTIONS.includes(requestedDirection)
    ? requestedDirection
    : "A";
  const navigatorLanguage = globalThis.navigator?.language ?? "";

  return {
    direction,
    locale: resolveLocale(url.search, navigatorLanguage),
  };
}

export function replaceReviewState(patch) {
  const url = new URL(window.location.href);

  if (patch.direction !== undefined) {
    url.searchParams.set(
      "direction",
      DIRECTIONS.includes(patch.direction) ? patch.direction : "A",
    );
  }

  if (patch.locale !== undefined) {
    url.searchParams.set("lang", patch.locale);
  }

  window.history.replaceState(window.history.state, "", url);
}

export function cycleDirection(current, step) {
  const currentIndex = DIRECTIONS.includes(current)
    ? DIRECTIONS.indexOf(current)
    : 0;
  const nextIndex = (currentIndex + step + DIRECTIONS.length) % DIRECTIONS.length;

  return DIRECTIONS[nextIndex];
}
