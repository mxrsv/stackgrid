import "../styles/direction-a.css";
import "../styles/aurora.css";
import "../styles/landing-sections.css";

import { messages } from "./copy.js";
import { renderDirectionA, updateDirectionALocale } from "./directions/a.js";
import {
  mountLandingSections,
  renderLandingSections,
  updateLandingSectionsLocale,
} from "./landing-sections.js";
import { LOCALES, readLocale, writeLocale } from "./locale-state.js";
import { mountDemoDialog } from "./product-stage.js";
import { messages as sectionMessages } from "./sections-copy.js";

const specimenRoot = document.querySelector("#specimen-root");
const demoRoot = document.querySelector("#demo-root");

if (!specimenRoot || !demoRoot) {
  throw new Error("Landing page roots are missing.");
}

let locale = readLocale(window.location);
let disposePage = () => {};
let landingSectionsRoot;

// Set up front so `[data-reveal]` content starts hidden and never flashes in
// before its reveal animation. It is dropped again if the reveal observer
// cannot be installed — see mountSections below.
document.documentElement.classList.add("has-js");

/**
 * Mount one page module without letting its failure take down the others.
 *
 * @param {string} name
 * @param {() => (() => void) | void} mount
 * @returns {() => void}
 */
function mountSafely(name, mount) {
  try {
    return mount() ?? (() => {});
  } catch (error) {
    console.error(`${name} failed to mount.`, error);
    return () => {};
  }
}

/**
 * Mount the landing sections, falling back to plain visible content.
 *
 * `has-js` holds every `[data-reveal]` node at `opacity: 0` until this
 * observer adds `is-visible`. Without the observer the class would hide the
 * whole page below the hero, so it has to go with it.
 *
 * @returns {() => void}
 */
function mountSections() {
  try {
    return mountLandingSections(landingSectionsRoot);
  } catch (error) {
    console.error("Landing sections failed to mount.", error);
    document.documentElement.classList.remove("has-js");
    return () => {};
  }
}

function render() {
  disposePage();

  const page = renderDirectionA(messages[locale], locale);
  specimenRoot.innerHTML = page.markup;
  specimenRoot.insertAdjacentHTML(
    "beforeend",
    renderLandingSections(sectionMessages[locale]),
  );
  landingSectionsRoot = specimenRoot.querySelector(".a-landing-sections");

  // The hero renderer drives a WebGL context; a blocked or missing one must
  // not stop the sections below it from mounting.
  const disposeRenderer = mountSafely("Hero renderer", () =>
    page.mount(specimenRoot),
  );
  const disposeSections = mountSections();
  const disposeDialog = mountSafely("Demo dialog", () =>
    mountDemoDialog(demoRoot, specimenRoot),
  );

  disposePage = () => {
    disposeDialog();
    disposeSections();
    disposeRenderer();
  };

  document.documentElement.lang = locale;
}

function handleLocaleClick(event) {
  const button = event.target.closest("button[data-locale]");

  if (!button || !specimenRoot.contains(button)) {
    return;
  }

  const nextLocale = button.dataset.locale;

  if (!LOCALES.includes(nextLocale) || nextLocale === locale) {
    return;
  }

  writeLocale(nextLocale);
  locale = readLocale(window.location);

  // Swap text in place instead of re-rendering: a full render tears down
  // the whole DOM plus the aurora canvas, which flashes blank for a frame.
  updateDirectionALocale(specimenRoot, messages[locale], locale);
  updateLandingSectionsLocale(landingSectionsRoot, sectionMessages[locale]);
  document.documentElement.lang = locale;
}

specimenRoot.addEventListener("click", handleLocaleClick);
render();
