import { agentPanes, sequenceSteps } from "../product-stage.js";

// The dominant split axis (terminal field row height) — matches
// copy.stageFocus ("Focus 65%") so the callout stays truthful to the real
// geometry.
const FOCUS_PERCENT = 65;

function renderPane(pane, index, sampleSessionLabel) {
  const lines = pane.lines
    .map(
      (line, lineIndex) => `
        <span
          class="e-pane__line"
          style="--e-line-index: ${index * 2 + lineIndex}"
        ><i aria-hidden="true">›</i>${line}</span>
      `,
    )
    .join("");

  return `
    <article
      class="e-pane${index === 0 ? " e-pane--active" : ""}"
      style="--e-pane-index: ${index}; --e-channel-accent: ${pane.accent}"
    >
      <span class="e-pane__channel-tick" aria-hidden="true"></span>
      <header class="e-pane__header">
        <span class="e-pane__agent">${pane.agent}</span>
        <span class="e-process-badge"><i aria-hidden="true"></i>${pane.process}</span>
        <span class="e-pane__cwd"><span>CWD</span>${pane.cwd}</span>
      </header>
      <div
        class="e-pane__transcript"
        aria-label="${sampleSessionLabel}: ${pane.agent}"
      >
        <span class="e-pane__session">${sampleSessionLabel}</span>
        ${lines}
      </div>
    </article>
  `;
}

function renderTicks(count) {
  return Array.from(
    { length: count },
    (_, index) => `<i style="--e-tick-index: ${index}" aria-hidden="true"></i>`,
  ).join("");
}

export function renderDirectionE(copy) {
  const panes = agentPanes
    .map((pane, index) => renderPane(pane, index, copy.sampleSessionLabel))
    .join("");
  const sequence = sequenceSteps
    .map(
      (step, index) => `
        <li class="${index === sequenceSteps.length - 1 ? "is-current" : ""}">
          <span>${step.number}</span>${step.label}
        </li>
      `,
    )
    .join("");

  return {
    markup: `
      <section class="direction-e">
        <aside class="e-mast" aria-label="${copy.navProduct} status">
          <a class="e-mast__mark" href="/landing-prototype/?direction=E" aria-label="${copy.navProduct}">
            <span class="e-mast__glyph" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
          </a>
          <div class="e-mast__status">
            <span class="e-live-dot" aria-hidden="true"></span>
            <span>${String(agentPanes.length).padStart(2, "0")}/${String(agentPanes.length).padStart(2, "0")}</span>
            <small>online</small>
          </div>
          <div class="e-mast__ticks" aria-hidden="true">
            ${renderTicks(9)}
          </div>
          <span class="e-mast__axis" aria-hidden="true">CRT / 01</span>
        </aside>

        <div class="e-field">
          <div class="e-headline">
            <a class="e-headline__github" href="https://github.com/mxrsv/stackgrid" target="_blank" rel="noreferrer">
              ${copy.navGithub}<span aria-hidden="true">↗</span>
            </a>
            <p class="e-eyebrow">${copy.eyebrow}</p>
            <h1>
              <span>${copy.headlineLead}</span>
              <span>${copy.headlineTail}</span>
            </h1>
            <p class="e-subhead">${copy.subhead}</p>
            <div class="e-actions">
              <button class="e-primary-cta" type="button" data-open-demo>
                <span>${copy.primaryCta}</span>
                <i aria-hidden="true">↗</i>
              </button>
              <a
                class="e-secondary-cta"
                href="https://github.com/mxrsv/stackgrid"
                target="_blank"
                rel="noreferrer"
              >
                ${copy.secondaryCta}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div class="e-terminal-crop">
            <figure class="e-terminal" aria-label="${copy.navProduct} agent workspace">
              <figcaption class="e-terminal__bar">
                <span class="e-terminal__preset">${copy.stagePreset}</span>
                <strong>${copy.stageWorkspace}</strong>
                <ol class="e-sequence" aria-label="Workspace sequence">
                  ${sequence}
                </ol>
                <span class="e-terminal__focus">${copy.stageFocus}</span>
              </figcaption>
              <div
                class="e-pane-grid"
                style="--e-focus-percent: ${FOCUS_PERCENT}%"
                data-focus-stage="${FOCUS_PERCENT}"
              >
                ${panes}
                <span class="e-focus-frame" aria-hidden="true"></span>
                <span class="e-scan-marker" aria-hidden="true"></span>
                <span class="e-scanmask" aria-hidden="true"></span>
              </div>
            </figure>
          </div>
        </div>
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".direction-e");

      if (!section) {
        throw new Error("Direction E root is missing.");
      }

      document.documentElement.dataset.directionTreatment = "e";

      return () => {
        if (document.documentElement.dataset.directionTreatment === "e") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
