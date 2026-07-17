function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyText(key, copy) {
  return `<span data-section-copy="${key}">${escapeHtml(copy[key])}</span>`;
}

function renderManifestRow(index, rowKey, copy) {
  const prefix = `manifestRow${rowKey}`;
  return `
              <article class="a-section-proof__row" role="listitem">
                <span class="a-section-proof__index">${index}</span>
                <div>
                  <div class="a-section-proof__mark">${copyText(`${prefix}Mark`, copy)}</div>
                  <h3>${copyText(`${prefix}Title`, copy)}</h3>
                  <p>${copyText(`${prefix}Desc`, copy)}</p>
                </div>
                <code class="a-section-proof__readout">${copyText(`${prefix}Readout`, copy)}</code>
              </article>`;
}

export function renderLandingSections(copy) {
  return `
    <div class="a-landing-sections">
      <section
        class="a-section-workflow"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div class="a-section-workflow__inner">
          <div class="a-section-workflow__copy" data-reveal>
            <p class="a-section-workflow__eyebrow">${copyText("workflowEyebrow", copy)}</p>
            <div class="a-section-workflow__head">
              <h2 id="workflow-title">
                ${copyText("workflowTitleLead", copy)}
                <em>${copyText("workflowTitleTail", copy)}</em>
              </h2>
              <p>${copyText("workflowDesc", copy)}</p>
            </div>
            <ol class="a-section-workflow__steps">
              <li>
                <b>01</b>
                <div>
                  <strong>${copyText("workflowStep1Title", copy)}</strong>
                  <span>${copyText("workflowStep1Desc", copy)}</span>
                </div>
              </li>
              <li>
                <b>02</b>
                <div>
                  <strong>${copyText("workflowStep2Title", copy)}</strong>
                  <span>${copyText("workflowStep2Desc", copy)}</span>
                </div>
              </li>
              <li class="a-section-workflow__step--key">
                <b>03</b>
                <div>
                  <strong>${copyText("workflowStep3Title", copy)}</strong>
                  <span>${copyText("workflowStep3Desc", copy)}</span>
                </div>
              </li>
            </ol>
          </div>

          <div
            class="a-section-workflow__visual"
            id="workflow-video"
            data-reveal
            style="--reveal-order: 1"
          >
            <div class="a-section-workflow__frame">
              <video
                data-workflow-video
                data-section-copy="workflowVideoLabel"
                muted
                loop
                playsinline
                preload="metadata"
                poster="/stackgrid-cmd-e-poster.png"
                aria-label="${escapeHtml(copy.workflowVideoLabel)}"
              >
                <source src="/stackgrid-cmd-e.webm" type="video/webm" />
                <source src="/stackgrid-cmd-e.mp4" type="video/mp4" />
                Your browser does not support HTML video.
              </video>
            </div>
            <div class="a-section-workflow__caption">
              <span>${copyText("workflowVideoCaption", copy)}</span>
              <span class="a-section-workflow__caption-actions">
                <button
                  class="a-section-workflow__video-toggle"
                  type="button"
                  data-video-toggle
                  data-section-copy-play-aria="workflowVideoPlayAria"
                  data-section-copy-pause-aria="workflowVideoPauseAria"
                  aria-pressed="false"
                  aria-label="${escapeHtml(copy.workflowVideoPlayAria)}"
                >
                  <span class="a-section-workflow__video-icon" data-video-icon>▶</span>
                  <span
                    data-video-label
                    data-section-copy-play="workflowVideoPlayLabel"
                    data-section-copy-pause="workflowVideoPauseLabel"
                    data-section-copy="workflowVideoPlayLabel"
                  >${escapeHtml(copy.workflowVideoPlayLabel)}</span>
                </button>
                <kbd>⌘E</kbd>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="a-section-proof" id="proof" aria-labelledby="proof-title">
        <div class="a-section-proof__inner">
          <div class="a-section-proof__layout">
            <div class="a-section-proof__intro a-section-proof__head" data-reveal>
              <p class="a-section-proof__eyebrow">${copyText("proofEyebrow", copy)}</p>
              <h2 id="proof-title">
                ${copyText("proofTitleLead", copy)}
                <em>${copyText("proofTitleTail", copy)}</em>
              </h2>
              <p class="a-section-proof__aside">${copyText("proofAside", copy)}</p>
              <span class="a-section-proof__signal">${copyText("proofSignal", copy)}</span>
            </div>

            <div
              class="a-section-proof__manifest"
              role="list"
              aria-label="Stackgrid terminal capabilities"
              data-reveal
              style="--reveal-order: 1"
            >
              <div class="a-section-proof__bar">
                <span>${copyText("manifestBarUri", copy)}</span>
                <span>${copyText("manifestBarStatus", copy)}</span>
              </div>
              ${renderManifestRow("01", 1, copy)}
              ${renderManifestRow("02", 2, copy)}
              ${renderManifestRow("03", 3, copy)}
              ${renderManifestRow("04", 4, copy)}
            </div>
          </div>
        </div>
      </section>

      <footer class="a-section-footer">
        <div class="a-section-footer__inner">
          <p class="a-section-footer__eyebrow">${copyText("footerEyebrow", copy)}</p>
          <h2>
            ${copyText("footerTitleLead", copy)}
            <span>${copyText("footerTitleTail", copy)}</span>
          </h2>
          <p class="a-section-footer__lead">${copyText("footerLead", copy)}</p>
          <div class="a-section-footer__actions">
            <a
              class="a-section-footer__primary-cta"
              href="https://github.com/mxrsv/stackgrid/releases/latest"
            >${copyText("footerPrimaryCta", copy)} <i aria-hidden="true">↓</i></a>
            <a class="a-section-footer__secondary-cta" href="#workflow-video">${copyText("footerSecondaryCta", copy)}</a>
          </div>
          <div class="a-section-footer__meta">
            <span>${copyText("footerMetaMacos", copy)}</span>
            <i aria-hidden="true"></i>
            <span>${copyText("footerMetaLocal", copy)}</span>
            <i aria-hidden="true"></i>
            <span>${copyText("footerMetaOpenSource", copy)}</span>
          </div>
          <p class="a-section-footer__install-note">${copyText("footerUnsignedNote", copy)}</p>
        </div>
        <div class="a-section-footer__bar">
          <span>${copyText("footerCopyright", copy)}</span>
          <nav class="a-section-footer__nav" aria-label="Stackgrid links">
            <a href="https://github.com/mxrsv/stackgrid">${copyText("footerNavGithub", copy)}</a>
            <a href="https://github.com/mxrsv/stackgrid/releases/latest">${copyText("footerNavReleases", copy)}</a>
          </nav>
        </div>
      </footer>
    </div>
  `.trim();
}
