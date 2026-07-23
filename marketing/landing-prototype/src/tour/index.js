/**
 * Scroll tour — sticky app window morphing through three chapters, plus the
 * closing band. MOCK fidelity (2026-07-23 spec): static transcripts, no
 * entrance animation; native scroll only, no wheel hijacking.
 */

import { stageSidebar } from "../product-stage.js";
import {
  AGENTS,
  PRESET_CELLS,
  boardRecents,
  tourPanes,
} from "./stage-states.js";

const STACKGRID_ICON_SRC = "/landing-prototype/assets/stackgrid-icon.svg";
const CHAPTER_COUNT = 3;

function renderChapterRail(copy) {
  const chapters = [1, 2, 3]
    .map(
      (n) => `
        <button type="button" class="tour__chapter" data-ch="${n}">
          <span class="tour__chapnum">0${n}</span>
          <span class="tour__chaptext">
            <strong data-copy="tourCh${n}Title">${copy[`tourCh${n}Title`]}</strong>
            <span data-copy="tourCh${n}Body">${copy[`tourCh${n}Body`]}</span>
          </span>
        </button>
      `,
    )
    .join("");

  return `
    <aside class="tour__rail">
      <span class="tour__kicker" data-copy="tourKicker">${copy.tourKicker}</span>
      ${chapters}
    </aside>
  `;
}

function renderAgentChip(agentId) {
  const agent = AGENTS[agentId];

  return `<span class="tour__agentchip" style="--chip-tint: ${agent.tint}">${agent.monogram}</span>`;
}

function renderPresetThumb(preset) {
  const cells = "<i></i>".repeat(PRESET_CELLS[preset]);

  return `<span class="tour__thumb" data-preset="${preset}">${cells}</span>`;
}

function renderBoardRecent(row) {
  return `
    <div class="tour__recent${row.highlighted ? " is-hot" : ""}">
      ${renderPresetThumb(row.preset)}
      <span class="tour__rectext">
        <strong>${row.label}</strong>
        <span>${row.path}</span>
      </span>
      <span class="tour__recagents">${row.agents.map(renderAgentChip).join("")}</span>
      ${row.highlighted ? '<kbd class="tour__openkbd">↵ Open</kbd>' : ""}
    </div>
  `;
}

function renderBoard() {
  const sideItems = stageSidebar
    .map(
      (item) => `
        <div class="tour__boarditem${item.active ? " is-active" : ""}">
          ${
            item.monogram === null
              ? `<img src="${STACKGRID_ICON_SRC}" alt="" />`
              : `<span class="tour__boardmono" style="--chip-tint: ${item.tint}">${item.monogram}</span>`
          }
          <span>${item.label}</span>
        </div>
      `,
    )
    .join("");

  return `
    <div class="tour__board">
      <aside class="tour__boardside">${sideItems}</aside>
      <div class="tour__boardmain">
        <div class="tour__boardlogo">
          <img src="${STACKGRID_ICON_SRC}" alt="" width="40" height="40" />
          <span>Stackgrid</span>
        </div>
        <div class="tour__recents">${boardRecents.map(renderBoardRecent).join("")}</div>
      </div>
    </div>
  `;
}

function renderPane(pane) {
  const agent = AGENTS[pane.id];
  const lines = pane.lines
    .map(
      (line) =>
        `<span class="tour__line${line.cls ? ` ${line.cls}` : ""}">${line.text}</span>`,
    )
    .join("");

  return `
    <article class="tour__pane${pane.focused ? " is-focused" : ""}" style="--pane-tint: ${agent.tint}">
      <header class="tour__panehead"><i class="tour__dot"></i>${agent.name}</header>
      <div class="tour__panebody">
        ${lines}
        <span class="tour__prompt">${pane.prompt} <i class="tour__cursor"></i></span>
      </div>
      ${pane.focused ? '<kbd class="tour__expandkbd">⌘E</kbd>' : ""}
    </article>
  `;
}

function renderGrid() {
  const [claude, codex, gemini] = tourPanes;

  return `
    <div class="tour__grid">
      <div class="tour__col">
        ${renderPane(claude)}
        ${renderPane(codex)}
      </div>
      ${renderPane(gemini)}
    </div>
  `;
}

function renderStage() {
  return `
    <figure class="tour__stage" role="img" aria-label="Stackgrid tour preview">
      <div class="tour__titlebar">
        <span class="tour__lights"><i></i><i></i><i></i></span>
        <span class="tour__wintitle">Stackgrid</span>
      </div>
      <div class="tour__scene" aria-hidden="true">
        ${renderBoard()}
        ${renderGrid()}
      </div>
      <footer class="tour__status" aria-hidden="true">
        <span>main</span>
        <span class="tour__statusdim">~/…/stackgrid</span>
        <span class="tour__statusright">
          <span>3 panes</span>
          <kbd>⌘E</kbd>
        </span>
      </footer>
    </figure>
  `;
}

function renderFinale(copy) {
  const proofs = ["Pty", "Local", "Native"]
    .map(
      (key) => `
        <article class="tour__proof">
          <strong data-copy="proof${key}Title">${copy[`proof${key}Title`]}</strong>
          <p data-copy="proof${key}Body">${copy[`proof${key}Body`]}</p>
        </article>
      `,
    )
    .join("");

  const shortcuts = [
    ["⌘D", "scSplit"],
    ["⌘⇧D", "scSplitH"],
    ["⌘T", "scTab"],
    ["⌘E", "scExpand"],
    ["⌘F", "scFind"],
    ["⌘K", "scClear"],
  ]
    .map(
      ([keys, copyKey]) => `
        <span class="tour__sc">
          <kbd>${keys}</kbd>
          <span data-copy="${copyKey}">${copy[copyKey]}</span>
        </span>
      `,
    )
    .join("");

  return `
    <footer class="tour__finale">
      <h2 data-copy="finaleTitle">${copy.finaleTitle}</h2>
      <div class="tour__proofs">${proofs}</div>
      <div class="tour__shortcuts">${shortcuts}</div>
      <div class="tour__ctas">
        <a
          class="tour__cta tour__cta--primary"
          href="https://github.com/mxrsv/stackgrid/releases/latest"
          target="_blank"
          rel="noreferrer"
        >
          <span data-copy="finaleDownload">${copy.finaleDownload}</span>
          <span aria-hidden="true">↓</span>
        </a>
        <button class="tour__cta" type="button" data-open-demo>
          <span data-copy="primaryCta">${copy.primaryCta}</span>
        </button>
        <a
          class="tour__cta"
          href="https://github.com/mxrsv/stackgrid"
          target="_blank"
          rel="noreferrer"
        >
          <span data-copy="secondaryCta">${copy.secondaryCta}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  `;
}

export function renderTour(copy) {
  return {
    markup: `
      <section class="tour" data-chapter="1">
        <div class="tour__track">
          <div class="tour__sticky">
            <div class="tour__layout">
              ${renderChapterRail(copy)}
              ${renderStage()}
            </div>
          </div>
        </div>
        ${renderFinale(copy)}
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".tour");

      if (!section) {
        throw new Error("Tour root is missing.");
      }

      const track = section.querySelector(".tour__track");
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      let rafId = null;

      function update() {
        rafId = null;

        const rect = track.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;

        if (scrollable <= 0) {
          return;
        }

        const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
        const chapter = String(
          Math.min(CHAPTER_COUNT, Math.floor(progress * CHAPTER_COUNT) + 1),
        );

        if (section.dataset.chapter !== chapter) {
          section.dataset.chapter = chapter;
        }
      }

      function schedule() {
        if (rafId === null) {
          rafId = requestAnimationFrame(update);
        }
      }

      function handleRailClick(event) {
        const button = event.target.closest(".tour__chapter");

        if (!button || !section.contains(button)) {
          return;
        }

        const rect = track.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const index = Number(button.dataset.ch) - 1;
        const target =
          window.scrollY +
          rect.top +
          scrollable * ((index + 0.5) / CHAPTER_COUNT);

        window.scrollTo({
          top: target,
          behavior: reduceMotion.matches ? "auto" : "smooth",
        });
      }

      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule, { passive: true });
      section.addEventListener("click", handleRailClick);
      update();

      return () => {
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        section.removeEventListener("click", handleRailClick);

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
      };
    },
  };
}

/**
 * Swap localized tour copy in place (same reasoning as the hero: keep the DOM
 * and scroll state alive across a locale toggle).
 *
 * @param {Element} root
 * @param {Record<string, string>} copy
 */
export function updateTourLocale(root, copy) {
  const section = root.querySelector(".tour");

  if (!section) {
    throw new Error("Tour root is missing.");
  }

  for (const node of section.querySelectorAll("[data-copy]")) {
    const text = copy[node.dataset.copy];

    if (typeof text === "string") {
      node.textContent = text;
    }
  }
}
