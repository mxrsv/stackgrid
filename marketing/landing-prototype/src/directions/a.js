import { mountHeroMotion } from "../hero-motion.js";
import { agentPanes, sequenceSteps } from "../product-stage.js";

function renderPane(pane, paneIndex, sampleSessionLabel) {
  const lines = pane.lines
    .map(
      (line, lineIndex) => `
        <span
          class="a-pane__line"
          style="--a-line-index: ${paneIndex * 2 + lineIndex}"
        ><i aria-hidden="true">›</i>${line}</span>
      `,
    )
    .join("");

  return `
    <article
      class="a-pane${paneIndex === 0 ? " a-pane--active" : ""}"
      style="--a-pane-index: ${paneIndex}"
    >
      <header class="a-pane__header">
        <span class="a-pane__agent">${pane.agent}</span>
        <span class="a-process-badge">
          <i aria-hidden="true"></i>
          ${pane.process}
        </span>
      </header>
      <p class="a-pane__cwd"><span>CWD</span>${pane.cwd}</p>
      <div
        class="a-pane__transcript"
        aria-label="${sampleSessionLabel}: ${pane.agent}"
      >
        <span class="a-pane__session-label">${sampleSessionLabel}</span>
        ${lines}
      </div>
    </article>
  `;
}

export function renderDirectionA(copy, locale) {
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
      <section class="direction-a" data-hero-motion="stream">
        <div class="a-motion" data-motion="stream" aria-hidden="true"></div>
        <aside class="a-rail" aria-label="${copy.navProduct} status">
          <a class="a-rail__mark" href="/landing-prototype/?direction=A" aria-label="${copy.navProduct}">
            <span class="a-mark-grid" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
            <strong>${copy.navProduct}</strong>
          </a>
          <div class="a-rail__status">
            <span class="a-live-dot" aria-hidden="true"></span>
            <span>${String(agentPanes.length).padStart(2, "0")} / ${String(agentPanes.length).padStart(2, "0")}</span>
            <small>agents online</small>
          </div>
          <span class="a-rail__axis" aria-hidden="true">PTY / 01</span>
        </aside>

        <div class="a-main">
          <header class="a-topbar">
            <a class="a-topbar__brand" href="/landing-prototype/?direction=A" aria-label="${copy.navProduct}">
              <span class="a-mark-grid" aria-hidden="true">
                <i></i><i></i><i></i><i></i>
              </span>
              <strong>${copy.navProduct}</strong>
            </a>
            <span class="a-topbar__descriptor">Native macOS / PTY field</span>
            <div class="a-topbar__lang" role="group" aria-label="${copy.localeLabel}">
              <button type="button" data-locale="en" aria-pressed="${locale === "en"}">EN</button>
              <span aria-hidden="true">/</span>
              <button type="button" data-locale="vi" aria-pressed="${locale === "vi"}">VI</button>
            </div>
            <a
              class="a-topbar__github"
              href="https://github.com/mxrsv/stackgrid"
              target="_blank"
              rel="noreferrer"
            >
              ${copy.navGithub}
              <span aria-hidden="true">↗</span>
            </a>
          </header>

          <div class="a-copy">
            <p class="a-eyebrow"><span aria-hidden="true"></span>${copy.eyebrow}</p>
            <h1>
              <span>${copy.headlineLead}</span>
              <span>${copy.headlineTail}</span>
            </h1>
            <p class="a-subhead">${copy.subhead}</p>
          </div>

          <figure class="a-stage" aria-label="${copy.navProduct} agent workspace">
            <figcaption class="a-stage__bar">
              <div>
                <span class="a-stage__preset">${copy.stagePreset}</span>
                <strong>${copy.stageWorkspace}</strong>
              </div>
              <ol class="a-sequence" aria-label="Workspace sequence">
                ${sequence}
              </ol>
              <span class="a-stage__focus">${copy.stageFocus}</span>
            </figcaption>
            <div class="a-pane-grid">
              ${panes}
              <span class="a-focus-frame" aria-hidden="true"></span>
              <span class="a-stage__crosshair a-stage__crosshair--top" aria-hidden="true"></span>
              <span class="a-stage__crosshair a-stage__crosshair--bottom" aria-hidden="true"></span>
            </div>
          </figure>

          <div class="a-actions">
            <button class="a-primary-cta" type="button" data-open-demo>
              <span>${copy.primaryCta}</span>
              <i aria-hidden="true">↗</i>
            </button>
            <a
              class="a-secondary-cta"
              href="https://github.com/mxrsv/stackgrid"
              target="_blank"
              rel="noreferrer"
            >
              ${copy.secondaryCta}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".direction-a");

      if (!section) {
        throw new Error("Direction A root is missing.");
      }

      document.documentElement.dataset.directionTreatment = "a";

      const disposeMotion = mountHeroMotion(section.querySelector(".a-motion"));

      return () => {
        disposeMotion();

        if (document.documentElement.dataset.directionTreatment === "a") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
