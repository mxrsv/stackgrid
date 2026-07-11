import { agentPanes, sequenceSteps } from "../product-stage.js";

// The dominant split axis (instrument row width) — matches copy.stageFocus
// ("Focus 65%") so the callout stays truthful to the real geometry.
const FOCUS_PERCENT = 65;

function renderPane(pane, index, sampleSessionLabel) {
  const lines = pane.lines
    .map(
      (line, lineIndex) => `
        <span
          class="d-pane__line"
          style="--d-line-index: ${index * 2 + lineIndex}"
        ><i aria-hidden="true">›</i>${line}</span>
      `,
    )
    .join("");

  return `
    <article
      class="d-pane${index === 0 ? " d-pane--active" : ""}"
      style="--d-pane-index: ${index}; --d-channel-accent: ${pane.accent}"
    >
      <span class="d-pane__channel-dot" aria-hidden="true"></span>
      <header class="d-pane__header">
        <span class="d-pane__agent">${pane.agent}</span>
        <span class="d-process-badge"><i aria-hidden="true"></i><span>${pane.process}</span></span>
      </header>
      <p class="d-pane__cwd"><span>CWD</span>${pane.cwd}</p>
      <div
        class="d-pane__transcript"
        aria-label="${sampleSessionLabel}: ${pane.agent}"
      >
        <span class="d-pane__session">${sampleSessionLabel}</span>
        ${lines}
      </div>
    </article>
  `;
}

export function renderDirectionD(copy) {
  const panes = agentPanes
    .map((pane, index) => renderPane(pane, index, copy.sampleSessionLabel))
    .join("");
  const sequence = sequenceSteps
    .map(
      (step, index) => `
        <li class="${index === sequenceSteps.length - 1 ? "is-current" : ""}">
          <span>${step.number}</span>
          ${step.label}
        </li>
      `,
    )
    .join("");

  return {
    markup: `
      <section class="direction-d">
        <header class="d-topbar">
          <a class="d-mark" href="/landing-prototype/?direction=D" aria-label="${copy.navProduct}">
            <span class="d-mark__glyph" aria-hidden="true"></span>
            <strong>${copy.navProduct}</strong>
          </a>
          <a class="d-topbar__github" href="https://github.com/mxrsv/stackgrid" target="_blank" rel="noreferrer">
            ${copy.navGithub}
            <span aria-hidden="true">↗</span>
          </a>
        </header>

        <div class="d-composition">
          <div class="d-aperture">
            <p class="d-eyebrow"><span aria-hidden="true"></span>${copy.eyebrow}</p>
            <h1>
              <span>${copy.headlineLead}</span>
              <span>${copy.headlineTail}</span>
            </h1>
            <p class="d-subhead">${copy.subhead}</p>
            <ol class="d-sequence" aria-label="Workspace sequence">
              ${sequence}
            </ol>
            <div class="d-actions">
              <button class="d-primary-cta" type="button" data-open-demo>
                <span>${copy.primaryCta}</span>
                <i aria-hidden="true">↗</i>
              </button>
              <a
                class="d-secondary-cta"
                href="https://github.com/mxrsv/stackgrid"
                target="_blank"
                rel="noreferrer"
              >
                ${copy.secondaryCta}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <figure class="d-instrument" aria-label="${copy.navProduct} agent workspace">
            <figcaption class="d-instrument__bar">
              <span class="d-instrument__preset">${copy.stagePreset}</span>
              <strong>${copy.stageWorkspace}</strong>
              <span class="d-instrument__focus">${copy.stageFocus}</span>
            </figcaption>
            <div
              class="d-pane-grid"
              style="--d-focus-percent: ${FOCUS_PERCENT}%"
              data-focus-stage="${FOCUS_PERCENT}"
            >
              ${panes}
              <span class="d-focus-frame" aria-hidden="true"></span>
              <span class="d-focus-halo" aria-hidden="true"></span>
              <span class="d-stage__crosshair d-stage__crosshair--top" aria-hidden="true"></span>
              <span class="d-stage__crosshair d-stage__crosshair--bottom" aria-hidden="true"></span>
            </div>
          </figure>
        </div>

        <footer class="d-footnote" aria-hidden="true">
          <span>04 channels</span>
          <span>one instrument</span>
          <span>macOS / PTY</span>
        </footer>
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".direction-d");

      if (!section) {
        throw new Error("Direction D root is missing.");
      }

      document.documentElement.dataset.directionTreatment = "d";

      return () => {
        if (document.documentElement.dataset.directionTreatment === "d") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
