import "../styles/direction-a.css";
import "../styles/aurora.css";

import { messages } from "./copy.js";
import { renderDirectionA } from "./directions/a.js";
import { LOCALES, readLocale, writeLocale } from "./locale-state.js";
import { mountDemoDialog } from "./product-stage.js";

const specimenRoot = document.querySelector("#specimen-root");
const demoRoot = document.querySelector("#demo-root");

if (!specimenRoot || !demoRoot) {
    throw new Error("Landing page roots are missing.");
}

let locale = readLocale(window.location);
let disposePage = () => {};

function render() {
    disposePage();

    const page = renderDirectionA(messages[locale], locale);
    specimenRoot.innerHTML = page.markup;
    const disposeRenderer = page.mount(specimenRoot);
    const disposeDialog = mountDemoDialog(demoRoot, specimenRoot);
    disposePage = () => {
        disposeDialog();
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
    render();
}

specimenRoot.addEventListener("click", handleLocaleClick);
render();
