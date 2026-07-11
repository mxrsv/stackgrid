import { cycleDirection, DIRECTIONS } from "./review-state.js";

const DIRECTION_LABELS = {
  A: "Agent Mission Control",
  B: "Native Spatial Studio",
  C: "Operator's Field Manual",
  D: "Signal Chamber",
  E: "Precision CRT",
};

export function mountReviewSwitcher(host, state, callbacks) {
  const direction = DIRECTIONS.includes(state.direction) ? state.direction : "A";
  const directionButtons = DIRECTIONS.map(
    (candidate) => `
      <button
        class="review-switcher__dot"
        type="button"
        data-direction="${candidate}"
        aria-label="Show direction ${candidate}: ${DIRECTION_LABELS[candidate]}"
        aria-current="${candidate === direction}"
        title="${candidate} — ${DIRECTION_LABELS[candidate]}"
      >${candidate}</button>
    `,
  ).join("");

  host.innerHTML = `
    <aside class="review-switcher" aria-label="Landing direction prototype controls">
      <span class="review-switcher__marker">PROTOTYPE</span>
      <div class="review-switcher__locale" role="group" aria-label="Language">
        <button type="button" data-locale="en" aria-pressed="${state.locale === "en"}">EN</button>
        <button type="button" data-locale="vi" aria-pressed="${state.locale === "vi"}">VI</button>
      </div>
      <button
        class="review-switcher__previous"
        type="button"
        data-step="-1"
        aria-label="Show previous direction"
      >←</button>
      <strong class="review-switcher__current">${direction} — ${DIRECTION_LABELS[direction]}</strong>
      <button
        class="review-switcher__next"
        type="button"
        data-step="1"
        aria-label="Show next direction"
      >→</button>
      <div class="review-switcher__directions" role="group" aria-label="Directions">
        ${directionButtons}
      </div>
    </aside>
  `;

  function handleClick(event) {
    const button = event.target.closest("button");

    if (!button || !host.contains(button)) {
      return;
    }

    if (button.dataset.direction) {
      callbacks.onDirectionChange(button.dataset.direction);
      return;
    }

    if (button.dataset.locale) {
      callbacks.onLocaleChange(button.dataset.locale);
      return;
    }

    if (button.dataset.step) {
      callbacks.onDirectionChange(
        cycleDirection(direction, Number(button.dataset.step)),
      );
    }
  }

  host.addEventListener("click", handleClick);

  return () => {
    host.removeEventListener("click", handleClick);
    host.replaceChildren();
  };
}
