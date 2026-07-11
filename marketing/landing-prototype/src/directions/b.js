import { agentPanes, sequenceSteps } from "../product-stage.js";

function renderPane(pane, index, sampleSessionLabel) {
  const lines = pane.lines
    .map(
      (line) => `
        <span class="b-pane__line"><i aria-hidden="true">›</i>${line}</span>
      `,
    )
    .join("");

  return `
    <article class="b-pane${index === 0 ? " b-pane--active" : ""}">
      <header class="b-pane__header">
        <span class="b-pane__index">${String(index + 1).padStart(2, "0")}</span>
        <strong>${pane.agent}</strong>
        <span class="b-pane__process"><i aria-hidden="true"></i>${pane.process}</span>
      </header>
      <p class="b-pane__cwd">${pane.cwd}</p>
      <div class="b-pane__transcript" aria-label="${sampleSessionLabel}: ${pane.agent}">
        <span class="b-pane__session">${sampleSessionLabel}</span>
        ${lines}
      </div>
    </article>
  `;
}

export function renderDirectionB(copy) {
  const panes = agentPanes
    .map((pane, index) =>
      renderPane(pane, index, copy.sampleSessionLabel),
    )
    .join("");
  const sequence = sequenceSteps
    .map(
      (step, index) => `
        <li class="${index === 1 ? "is-active" : ""}">
          <span>${step.number}</span>${step.label}
        </li>
      `,
    )
    .join("");

  return {
    markup: `
      <section class="direction-b">
        <header class="b-nav">
          <a class="b-wordmark" href="/landing-prototype/?direction=B" aria-label="${copy.navProduct}">
            <span class="b-wordmark__glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <strong>${copy.navProduct}</strong>
          </a>
          <span class="b-nav__note">Native spatial studio / 04 live</span>
          <a class="b-nav__github" href="https://github.com/mxrsv/stackgrid" target="_blank" rel="noreferrer">
            ${copy.navGithub}<span aria-hidden="true">↗</span>
          </a>
        </header>

        <div class="b-composition">
          <div class="b-copy">
            <p class="b-eyebrow"><span aria-hidden="true">⌁</span>${copy.eyebrow}</p>
            <h1>
              <span>${copy.headlineLead}</span>
              <em>${copy.headlineTail}</em>
            </h1>
            <p class="b-subhead">${copy.subhead}</p>
            <div class="b-actions">
              <button class="b-primary-cta" type="button" data-open-demo>
                <span class="b-primary-cta__index">01</span>
                <strong>${copy.primaryCta}</strong>
                <i aria-hidden="true">↗</i>
              </button>
              <a class="b-secondary-cta" href="https://github.com/mxrsv/stackgrid" target="_blank" rel="noreferrer">
                <span>${copy.secondaryCta}</span><i aria-hidden="true">→</i>
              </a>
            </div>
          </div>

          <figure class="b-spatial" aria-label="${copy.navProduct} agent workspace">
            <div class="b-window-stack">
              <div class="b-plane b-plane--preset" aria-hidden="true">
                <div class="b-rear-bar">
                  <span>${copy.stagePreset}</span>
                  <strong>${copy.stageWorkspace}</strong>
                </div>
                <ol class="b-sequence">${sequence}</ol>
                <span class="b-plane__axis">LAYOUT / 02</span>
              </div>

              <div class="b-plane b-plane--focus" aria-hidden="true">
                <div class="b-focus-readout">
                  <span>FOCUS EXPAND</span>
                  <strong>${copy.stageFocus}</strong>
                </div>
                <div class="b-focus-map"><i></i><i></i><i></i><i></i></div>
                <span class="b-plane__axis">CMD · E</span>
              </div>

              <div class="b-plane b-plane--front">
                <figcaption class="b-window-bar">
                  <div class="b-machined-controls" aria-hidden="true">
                    <span class="b-control b-control--grid"><i></i><i></i><i></i><i></i></span>
                    <span class="b-control b-control--split"></span>
                    <span class="b-control b-control--focus"></span>
                  </div>
                  <div class="b-window-title">
                    <span>${copy.stagePreset}</span>
                    <strong>${copy.stageWorkspace}</strong>
                  </div>
                  <span class="b-window-focus">${copy.stageFocus}</span>
                </figcaption>
                <div class="b-pane-grid" data-focus-stage="65" aria-label="${copy.stageFocus}">
                  ${panes}
                </div>
              </div>
            </div>
          </figure>
        </div>

        <footer class="b-footnote" aria-hidden="true">
          <span>04 terminals</span>
          <span>one native field</span>
          <span>macOS / PTY</span>
        </footer>
      </section>
    `,
    mount(root) {
      const section = root.querySelector(".direction-b");
      const spatial = section?.querySelector(".b-spatial");

      if (!section || !spatial) {
        throw new Error("Direction B spatial root is missing.");
      }

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );
      const coarsePointer = window.matchMedia("(pointer: coarse)");
      let pointerEnabled = false;
      let frame = 0;
      let nextX = 0;
      let nextY = 0;

      document.documentElement.dataset.directionTreatment = "b";

      function applyParallax() {
        frame = 0;
        spatial.style.setProperty("--b-drift-x", `${nextX.toFixed(2)}px`);
        spatial.style.setProperty("--b-drift-y", `${nextY.toFixed(2)}px`);
      }

      function queueParallax(x, y) {
        nextX = x;
        nextY = y;

        if (!frame) {
          frame = window.requestAnimationFrame(applyParallax);
        }
      }

      function handlePointerMove(event) {
        const bounds = spatial.getBoundingClientRect();
        const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
        const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;
        queueParallax(
          Math.max(-4, Math.min(4, normalizedX * 8)),
          Math.max(-3, Math.min(3, normalizedY * 6)),
        );
      }

      function handlePointerLeave() {
        queueParallax(0, 0);
      }

      function syncPointerMotion() {
        const shouldEnable = !reduceMotion.matches && !coarsePointer.matches;

        if (shouldEnable === pointerEnabled) {
          return;
        }

        pointerEnabled = shouldEnable;

        if (pointerEnabled) {
          spatial.addEventListener("pointermove", handlePointerMove, {
            passive: true,
          });
          spatial.addEventListener("pointerleave", handlePointerLeave);
        } else {
          spatial.removeEventListener("pointermove", handlePointerMove);
          spatial.removeEventListener("pointerleave", handlePointerLeave);
          queueParallax(0, 0);
        }
      }

      reduceMotion.addEventListener("change", syncPointerMotion);
      coarsePointer.addEventListener("change", syncPointerMotion);
      syncPointerMotion();

      return () => {
        spatial.removeEventListener("pointermove", handlePointerMove);
        spatial.removeEventListener("pointerleave", handlePointerLeave);
        reduceMotion.removeEventListener("change", syncPointerMotion);
        coarsePointer.removeEventListener("change", syncPointerMotion);

        if (frame) {
          window.cancelAnimationFrame(frame);
        }

        if (document.documentElement.dataset.directionTreatment === "b") {
          delete document.documentElement.dataset.directionTreatment;
        }
      };
    },
  };
}
