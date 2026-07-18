import type { ISearchOptions } from "@xterm/addon-search";
import { settings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import type { Pane } from "./pane";

/** "resultIndex/resultCount" for the bar counter; "0/0" when empty. */
export function formatMatchCount(
  resultIndex: number,
  resultCount: number,
): string {
  if (resultCount === 0) {
    return "0/0";
  }
  // The addon reports -1 when the active match is not tracked (e.g. beyond
  // its highlight limit) — show only the total instead of a bogus "0/N".
  return resultIndex < 0
    ? `${resultCount}`
    : `${resultIndex + 1}/${resultCount}`;
}

interface OpenBar {
  readonly pane: Pane;
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  readonly disposeResults: () => void;
}

// One search bar at a time across all panes and tabs.
let current: OpenBar | null = null;

function searchOptions(incremental: boolean): ISearchOptions {
  const theme = resolveTheme(settings.value);
  const match = theme.selectionBackground ?? "#33467c";
  const activeMatch = theme.yellow ?? "#e0af68";
  return {
    incremental,
    decorations: {
      matchBackground: match,
      activeMatchBackground: activeMatch,
      // Painted on the overview ruler (pane sets overviewRuler.width).
      matchOverviewRuler: match,
      activeMatchColorOverviewRuler: activeMatch,
    },
  };
}

/** NFC so an IME-typed NFD term still matches composed buffer text. */
function searchTerm(value: string): string {
  return value.normalize("NFC");
}

function barButton(
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-bar__btn";
  button.textContent = label;
  button.title = title;
  // Keep the input focused while clicking the bar's buttons
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", onClick);
  return button;
}

/** Open (or refocus) the bar on `pane`; any bar on another pane closes. */
export function openSearchBar(pane: Pane): void {
  if (current?.pane.id === pane.id) {
    current.input.focus();
    current.input.select();
    return;
  }
  closeSearchBar();

  const element = document.createElement("div");
  element.className = "search-bar";
  const input = document.createElement("input");
  input.className = "search-bar__input";
  input.type = "text";
  input.placeholder = "Find";
  input.spellcheck = false;
  const counter = document.createElement("span");
  counter.className = "search-bar__count";

  const findNext = (): void => {
    if (input.value !== "") {
      pane.search.findNext(searchTerm(input.value), searchOptions(false));
    }
  };
  const findPrevious = (): void => {
    if (input.value !== "") {
      pane.search.findPrevious(searchTerm(input.value), searchOptions(false));
    }
  };

  element.append(
    input,
    counter,
    barButton("‹", "Previous match (⇧↩)", findPrevious),
    barButton("›", "Next match (↩)", findNext),
    barButton("×", "Close (Esc)", closeSearchBar),
  );

  const results = pane.search.onDidChangeResults(
    ({ resultIndex, resultCount }) => {
      counter.textContent = formatMatchCount(resultIndex, resultCount);
    },
  );

  input.addEventListener("input", () => {
    if (input.value === "") {
      pane.search.clearDecorations();
      counter.textContent = "";
      return;
    }
    // Incremental: the current selection expands instead of jumping ahead
    pane.search.findNext(searchTerm(input.value), searchOptions(true));
  });

  // The global shortcut handler skips inputs outside .pane__term, so the
  // bar handles its own keys — including Cmd+F to refocus/select-all.
  element.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearchBar();
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      findPrevious();
    } else if (event.key === "Enter") {
      event.preventDefault();
      findNext();
    } else if (event.metaKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  pane.element.appendChild(element);
  current = { pane, element, input, disposeResults: () => results.dispose() };
  input.focus();
}

/** Close the bar, clear highlights, refocus the terminal. */
export function closeSearchBar(): void {
  if (current === null) {
    return;
  }
  const { pane, element, disposeResults } = current;
  current = null;
  disposeResults();
  pane.search.clearDecorations();
  element.remove();
  pane.focus();
}

/** Drop the bar when its pane is being disposed — no decoration/focus calls. */
export function closeSearchBarForPane(paneId: number): void {
  if (current?.pane.id !== paneId) {
    return;
  }
  const { element, disposeResults } = current;
  current = null;
  disposeResults();
  element.remove();
}
