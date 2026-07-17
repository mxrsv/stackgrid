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

document.documentElement.classList.add("has-js");

function render() {
  disposePage();

  const page = renderDirectionA(messages[locale], locale);
  specimenRoot.innerHTML = page.markup;
  specimenRoot.insertAdjacentHTML(
    "beforeend",
    renderLandingSections(sectionMessages[locale]),
  );
  landingSectionsRoot = specimenRoot.querySelector(".a-landing-sections");
  const disposeRenderer = page.mount(specimenRoot);
  const disposeSections = mountLandingSections(landingSectionsRoot);
  const disposeDialog = mountDemoDialog(demoRoot, specimenRoot);
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
