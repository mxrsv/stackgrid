import { mountAurora } from "../aurora.js";
import {
  STAGE_ARIA_LABEL,
  mountStageStream,
  stagePanes,
  stageSidebar,
  stageStatus,
} from "../product-stage.js";

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

const STAGE_ICONS = {
  splitRow:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><line x1="12" y1="4.5" x2="12" y2="19.5"/>',
  splitColumn:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><line x1="3.5" y1="12" x2="20.5" y2="12"/>',
  closePane:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 9.5l5 5m0-5l-5 5"/>',
  expand:
    '<path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v3"/><path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v3"/><path d="M9 19.5H6A1.5 1.5 0 0 1 4.5 18v-3"/><path d="M15 19.5h3a1.5 1.5 0 0 0 1.5-1.5v-3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z"/>',
};

function renderChromeIcon(paths) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function renderStageTitlebar() {
  const icons = ["splitRow", "splitColumn", "closePane", "expand"]
    .map(
      (name) =>
        `<span class="a-appwin__iconbtn">${renderChromeIcon(STAGE_ICONS[name])}</span>`,
    )
    .join("");

  return `
    <div class="a-appwin__titlebar">
      <span class="a-appwin__lights"><i></i><i></i><i></i></span>
      <span class="a-appwin__actions">
        ${icons}
        <span class="a-appwin__actionsep"></span>
        <span class="a-appwin__iconbtn">${renderChromeIcon(STAGE_ICONS.gear)}</span>
      </span>
    </div>
  `;
}

function renderStageSidebar() {
  const items = stageSidebar
    .map(
      (item) => `
        <div class="a-appwin__wsitem${item.active ? " is-active" : ""}">
          ${
            item.monogram === null
              ? `<img class="a-appwin__wslogo" src="${STACKGRID_ICON_SRC}" alt="" />`
              : `<span class="a-appwin__wslogo a-appwin__wslogo--mono" style="--ws-tint: ${item.tint}">${item.monogram}</span>`
          }
          <span class="a-appwin__wstext">
            <span class="a-appwin__wslabel">${item.label}</span>
            <span class="a-appwin__wspath">${item.path}</span>
          </span>
          ${item.active ? '<span class="a-appwin__wsclose">×</span>' : ""}
        </div>
      `,
    )
    .join("");

  return `
    <aside class="a-appwin__sidebar">
      ${items}
      <div class="a-appwin__wsadd"><span>+</span>Open workspace</div>
    </aside>
  `;
}

function renderStagePane(pane) {
  const footer = pane.footer
    .map(
      (line) =>
        `<span class="a-appwin__footline${line.cls ? ` ${line.cls}` : ""}">${line.text}</span>`,
    )
    .join("");

  return `
    <article class="a-appwin__pane${pane.focused ? " is-focused" : ""}">
      <div class="a-appwin__transcript" data-stream="${pane.id}">
        <div class="a-appwin__lines" data-lines></div>
        <div class="a-appwin__spinner" data-spinner hidden></div>
      </div>
      <div class="a-appwin__panefoot">
        <div class="a-appwin__promptbox">
          <span class="a-appwin__promptglyph">${pane.prompt}</span>
          <i class="a-appwin__cursor"></i>
        </div>
        ${footer}
      </div>
    </article>
  `;
}

function renderStageStatus() {
  const hints = stageStatus.hints
    .map(
      (hint) =>
        `<span class="a-appwin__hint">${hint.label}</span><kbd class="a-appwin__kbd">${hint.key}</kbd>`,
    )
    .join("");

  return `
    <footer class="a-appwin__status">
      <span class="a-appwin__seg"><i class="a-appwin__gitdot"></i>${stageStatus.branch}</span>
      <span class="a-appwin__vsep"></span>
      <span class="a-appwin__seg a-appwin__seg--cwd">${stageStatus.cwd}</span>
      <span class="a-appwin__statusright">
        <span class="a-appwin__seg">${stageStatus.paneCount}</span>
        <span class="a-appwin__vsep"></span>
        <span class="a-appwin__seg">${stageStatus.theme}</span>
        <span class="a-appwin__vsep"></span>
        <span class="a-appwin__seg">${hints}</span>
      </span>
    </footer>
  `;
}

export function renderDirectionA(copy, locale) {
  const [claudePane, codexPane, opencodePane] = stagePanes;

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
            <div class="a-topbar__lang" role="group" aria-label="${copy.localeLabel}" data-active="${locale}">
              <span class="a-topbar__lang-thumb" aria-hidden="true"></span>
              <button type="button" class="a-topbar__lang-btn" data-locale="en" aria-pressed="${locale === "en"}">EN</button>
              <button type="button" class="a-topbar__lang-btn" data-locale="vi" aria-pressed="${locale === "vi"}">VI</button>
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

          <figure class="a-appwin" role="img" aria-label="${STAGE_ARIA_LABEL}">
            ${renderStageTitlebar()}
            <div class="a-appwin__body" aria-hidden="true">
              ${renderStageSidebar()}
              <div class="a-appwin__grid">
                <div class="a-appwin__col">
                  ${renderStagePane(claudePane)}
                  ${renderStagePane(codexPane)}
                </div>
                ${renderStagePane(opencodePane)}
              </div>
            </div>
            ${renderStageStatus()}
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
      const disposeStream = mountStageStream(
        section.querySelector(".a-appwin__grid"),
      );

      return () => {
        disposeStream();
        disposeMotion();

        if (document.documentElement.dataset.directionTreatment === "a") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
