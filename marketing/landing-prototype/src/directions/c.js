import { agentPanes, sequenceSteps } from "../product-stage.js";

// Dominant pane occupies 65% of the plate's vertical axis — matches
// copy.stageFocus ("Focus 65%") so the callout stays truthful to the copy.
const PLATE_FOCUS_PERCENT = 65;

function renderPane(pane, index, sampleSessionLabel) {
  const lines = pane.lines
    .map(
      (line, lineIndex) => `
        <span
          class="c-pane__line"
          style="--c-line-index: ${index * 2 + lineIndex}"
        ><i aria-hidden="true">›</i>${line}</span>
      `,
    )
    .join("");

  return `
    <article
      class="c-pane${index === 0 ? " c-pane--active" : ""}"
      style="--c-pane-index: ${index}"
    >
      <header class="c-pane__header">
        <span class="c-pane__tag">${String(index + 1).padStart(2, "0")}</span>
        <strong class="c-pane__agent">${pane.agent}</strong>
        <span class="c-pane__process"><i aria-hidden="true"></i>${pane.process}</span>
      </header>
      <p class="c-pane__cwd"><span>CWD</span>${pane.cwd}</p>
      <div class="c-pane__transcript" aria-label="${sampleSessionLabel}: ${pane.agent}">
        <span class="c-pane__session">${sampleSessionLabel}</span>
        ${lines}
      </div>
    </article>
  `;
}

function renderIndexItem(step, index, values) {
  return `
    <li class="c-index__item c-index__item--${step.label}" style="--c-index-i: ${index}">
      <span class="c-index__number">${step.number}</span>
      <span class="c-index__copy">
        <span class="c-index__label">${step.label}</span>
        <span class="c-index__value">${values[step.label]}</span>
      </span>
    </li>
  `;
}

export function renderDirectionC(copy) {
  const panes = agentPanes
    .map((pane, index) => renderPane(pane, index, copy.sampleSessionLabel))
    .join("");

  const indexValues = {
    preset: copy.stageWorkspace,
    grid: `${agentPanes.length} panes / ${PLATE_FOCUS_PERCENT}·${100 - PLATE_FOCUS_PERCENT}`,
    focus: copy.stageFocus,
  };
  const index = sequenceSteps
    .map((step, stepIndex) => renderIndexItem(step, stepIndex, indexValues))
    .join("");

  return {
    markup: `
      <section class="direction-c">
        <span class="c-reg c-reg--tl" aria-hidden="true"></span>
        <span class="c-reg c-reg--tr" aria-hidden="true"></span>
        <span class="c-reg c-reg--bl" aria-hidden="true"></span>
        <span class="c-reg c-reg--br" aria-hidden="true"></span>

        <header class="c-masthead">
          <a class="c-masthead__mark" href="/landing-prototype/?direction=C" aria-label="${copy.navProduct}">
            <span class="c-masthead__glyph" aria-hidden="true">§</span>
            <strong>${copy.navProduct}</strong>
          </a>
          <span class="c-masthead__plate">Field Manual / Vol. 01 — Agent Ops</span>
          <a class="c-masthead__github" href="https://github.com/mxrsv/stackgrid" target="_blank" rel="noreferrer">
            ${copy.navGithub}<span aria-hidden="true">↗</span>
          </a>
        </header>

        <div class="c-spread">
          <div class="c-cover">
            <p class="c-cover__eyebrow"><span>Fig. 01</span>${copy.eyebrow}</p>
            <h1 class="c-cover__headline">
              <span>${copy.headlineLead}</span>
              <span>${copy.headlineTail}</span>
            </h1>
            <p class="c-cover__dek">${copy.subhead}</p>
            <div class="c-cover__actions">
              <button class="c-primary-cta" type="button" data-open-demo>
                <span>${copy.primaryCta}</span>
                <i aria-hidden="true">↗</i>
              </button>
              <a
                class="c-secondary-cta"
                href="https://github.com/mxrsv/stackgrid"
                target="_blank"
                rel="noreferrer"
              >
                ${copy.secondaryCta}<span aria-hidden="true">→</span>
              </a>
            </div>
            <dl class="c-colophon">
              <div>
                <dt>Plate</dt>
                <dd>${String(agentPanes.length).padStart(2, "0")} panes bound / 01 native field</dd>
              </div>
              <div>
                <dt>Print</dt>
                <dd>Vermilion signal on warm stock</dd>
              </div>
            </dl>
          </div>

          <div class="c-diagram">
            <ol class="c-index" aria-label="Workspace sequence">
              ${index}
            </ol>

            <figure class="c-plate" aria-label="${copy.navProduct} agent workspace">
              <figcaption class="c-plate__slug">
                <span class="c-plate__preset">${copy.stagePreset}</span>
                <strong>${copy.stageWorkspace}</strong>
              </figcaption>
              <div class="c-plate__frame">
                <div
                  class="c-pane-grid"
                  style="--c-focus-percent: ${PLATE_FOCUS_PERCENT}%"
                  data-focus-stage="${PLATE_FOCUS_PERCENT}"
                >
                  ${panes}
                  <span class="c-focus-mark" aria-hidden="true"></span>
                </div>
                <span class="c-grid-boundary" aria-hidden="true"></span>
                <span class="c-focus-badge">${copy.stageFocus}</span>
              </div>
            </figure>

            <svg
              class="c-leaders"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <circle class="c-leader-dot c-leader-dot--01-a" cx="16" cy="12" r="0.6" />
              <path class="c-leader c-leader--01" pathLength="1" d="M16 12 H17.3 V8 H32" />
              <circle class="c-leader-dot c-leader-dot--01-b" cx="32" cy="8" r="0.6" />

              <circle class="c-leader-dot c-leader-dot--02-a" cx="16" cy="50" r="0.6" />
              <path class="c-leader c-leader--02" pathLength="1" d="M16 50 H18.6 V69 H58" />
              <circle class="c-leader-dot c-leader-dot--02-b" cx="58" cy="69" r="0.6" />

              <circle class="c-leader-dot c-leader-dot--03-a" cx="16" cy="88" r="0.6" />
              <path class="c-leader c-leader--03" pathLength="1" d="M16 88 H19.9 V69 H90" />
              <circle class="c-leader-dot c-leader-dot--03-b" cx="90" cy="69" r="0.6" />
            </svg>
          </div>
        </div>

        <footer class="c-footnote" aria-hidden="true">
          <span>Printed for operators</span>
          <span>Native macOS / PTY</span>
          <span>Vol. 01</span>
        </footer>
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".direction-c");
      const plate = section?.querySelector(".c-plate");

      if (!section || !plate) {
        throw new Error("Direction C plate root is missing.");
      }

      document.documentElement.dataset.directionTreatment = "c";

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );

      function syncReducedMotion() {
        plate.classList.toggle("c-plate--reduced", reduceMotion.matches);
      }

      reduceMotion.addEventListener("change", syncReducedMotion);
      syncReducedMotion();

      return () => {
        reduceMotion.removeEventListener("change", syncReducedMotion);

        if (document.documentElement.dataset.directionTreatment === "c") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
