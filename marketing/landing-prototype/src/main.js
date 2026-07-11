import "../styles/direction-a.css";
import "../styles/direction-b.css";
import "../styles/direction-c.css";
import "../styles/direction-d.css";
import "../styles/direction-e.css";

import { messages } from "./copy.js";
import { renderDirectionA } from "./directions/a.js";
import { renderDirectionB } from "./directions/b.js";
import { renderDirectionC } from "./directions/c.js";
import { renderDirectionD } from "./directions/d.js";
import { renderDirectionE } from "./directions/e.js";
import { mountDemoDialog } from "./product-stage.js";
import { mountReviewSwitcher } from "./review-switcher.js";
import {
  cycleDirection,
  readReviewState,
  replaceReviewState,
} from "./review-state.js";

const renderers = {
  A: renderDirectionA,
  B: renderDirectionB,
  C: renderDirectionC,
  D: renderDirectionD,
  E: renderDirectionE,
};

const specimenRoot = document.querySelector("#specimen-root");
const reviewRoot = document.querySelector("#review-root");
const demoRoot = document.querySelector("#demo-root");
const ignoredKeyboardTargets =
  "input, textarea, select, button, a, [contenteditable='true']";

if (!specimenRoot || !reviewRoot || !demoRoot) {
  throw new Error("Landing prototype roots are missing.");
}

let state = readReviewState(window.location);
let disposeDirection = () => {};
let disposeSwitcher = () => {};

function render() {
  const { direction, locale } = state;

  disposeDirection();
  const specimen = renderers[direction](messages[locale]);
  specimenRoot.innerHTML = specimen.markup;
  const disposeRenderer = specimen.mount(specimenRoot);
  const disposeDialog = mountDemoDialog(demoRoot, specimenRoot);
  disposeDirection = () => {
    disposeDialog();
    disposeRenderer();
  };

  disposeSwitcher();
  disposeSwitcher = mountReviewSwitcher(reviewRoot, state, {
    onDirectionChange(nextDirection) {
      updateState({ direction: nextDirection });
    },
    onLocaleChange(nextLocale) {
      updateState({ locale: nextLocale });
    },
  });

  document.documentElement.lang = locale;
}

function updateState(patch) {
  replaceReviewState(patch);
  state = readReviewState(window.location);
  render();
}

function handleKeydown(event) {
  if (
    event.target instanceof Element &&
    event.target.matches(ignoredKeyboardTargets)
  ) {
    return;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
    return;
  }

  event.preventDefault();
  updateState({
    direction: cycleDirection(
      state.direction,
      event.key === "ArrowLeft" ? -1 : 1,
    ),
  });
}

window.addEventListener("keydown", handleKeydown);
render();
