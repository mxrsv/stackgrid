import { mountAurora } from "../aurora.js";
import { agentPanes, sequenceSteps } from "../product-stage.js";

const PARTNER_MARK_SRC = "/landing-prototype/assets/partner-mark.svg";
const STACKGRID_ICON_SRC = "/landing-prototype/assets/stackgrid-icon.svg";

function renderGithubIcon() {
    return `
    <svg class="a-github-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.1-.55-.17-.55-.38
        0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95
        0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27
        -.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12
        -.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07
        -.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13
        .16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
    </svg>
  `;
}

function renderBrandMark(copy) {
    return `
    <span class="a-brand-mark" aria-hidden="true">
      <img class="a-partner-mark" src="${PARTNER_MARK_SRC}" alt="" width="22" height="22" />
      <span class="a-brand-divider"></span>
      <img class="a-stackgrid-icon" src="${STACKGRID_ICON_SRC}" alt="" width="28" height="28" />
    </span>
    <strong>${copy.navProduct}</strong>
  `;
}

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
    const panes = agentPanes.map((pane, index) => renderPane(pane, index, copy.sampleSessionLabel)).join("");
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
      <section class="direction-a" data-hero-motion="aurora">
        <div class="a-motion" data-motion="aurora" aria-hidden="true"></div>

        <div class="a-main">
          <header class="a-topbar">
            <a class="a-topbar__brand" href="/landing-prototype/?direction=A" aria-label="${copy.navProduct}">
              ${renderBrandMark(copy)}
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
              ${renderGithubIcon()}
              ${copy.navGithub}
              <span aria-hidden="true">↗</span>
            </a>
          </header>

          <div class="a-copy">
            <h1>
              <span>${copy.headlineLead}</span>
              <span data-text="${copy.headlineTail}">${copy.headlineTail}</span>
            </h1>
            <p class="a-subhead">${copy.subhead}</p>
          </div>

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
              ${renderGithubIcon()}
              ${copy.secondaryCta}
              <span aria-hidden="true">→</span>
            </a>
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
        </div>
      </section>
    `,
        mount(root) {
            const section = root.querySelector(".direction-a");

            if (!section) {
                throw new Error("Direction A root is missing.");
            }

            document.documentElement.dataset.directionTreatment = "a";

            const disposeMotion = mountAurora(section.querySelector(".a-motion"));

            return () => {
                disposeMotion();

                if (document.documentElement.dataset.directionTreatment === "a") {
                    delete document.documentElement.dataset.directionTreatment;
                }
            };
        },
    };
}
