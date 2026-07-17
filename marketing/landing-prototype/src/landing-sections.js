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
                  data-section-copy-play-aria-value="${escapeHtml(copy.workflowVideoPlayAria)}"
                  data-section-copy-pause-aria-value="${escapeHtml(copy.workflowVideoPauseAria)}"
                  aria-pressed="false"
                  aria-label="${escapeHtml(copy.workflowVideoPlayAria)}"
                >
                  <span class="a-section-workflow__video-icon" data-video-icon>▶</span>
                  <span
                    data-video-label
                    data-section-copy-play="workflowVideoPlayLabel"
                    data-section-copy-pause="workflowVideoPauseLabel"
                    data-section-copy-play-value="${escapeHtml(copy.workflowVideoPlayLabel)}"
                    data-section-copy-pause-value="${escapeHtml(copy.workflowVideoPauseLabel)}"
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

function getCopyValue(copy, key) {
  const value = copy[key];
  return typeof value === "string" ? value : null;
}

function updateVideoToggle(root) {
  const video = root.querySelector("[data-workflow-video]");
  const toggle = root.querySelector("[data-video-toggle]");

  if (!video || !toggle) {
    return;
  }

  const isPlaying = !video.paused;
  const state = isPlaying ? "pause" : "play";
  const label = root.querySelector("[data-video-label]");
  const icon = root.querySelector("[data-video-icon]");
  const labelValue = label?.getAttribute(
    `data-section-copy-${state}-value`,
  );
  const ariaValue = toggle.getAttribute(
    `data-section-copy-${state}-aria-value`,
  );

  toggle.setAttribute("aria-pressed", String(isPlaying));

  if (ariaValue) {
    toggle.setAttribute("aria-label", ariaValue);
  }

  if (label && labelValue) {
    label.textContent = labelValue;
  }

  if (icon) {
    icon.textContent = isPlaying ? "Ⅱ" : "▶";
  }
}

function updateVideoCopy(root, copy) {
  const label = root.querySelector("[data-video-label]");
  const toggle = root.querySelector("[data-video-toggle]");

  if (label) {
    for (const state of ["play", "pause"]) {
      const value = getCopyValue(
        copy,
        label.getAttribute(`data-section-copy-${state}`),
      );

      if (value) {
        label.setAttribute(`data-section-copy-${state}-value`, value);
      }
    }
  }

  if (toggle) {
    for (const state of ["play", "pause"]) {
      const value = getCopyValue(
        copy,
        toggle.getAttribute(`data-section-copy-${state}-aria`),
      );

      if (value) {
        toggle.setAttribute(`data-section-copy-${state}-aria-value`, value);
      }
    }
  }

  updateVideoToggle(root);
}

function getReducedMotionQuery(root) {
  const view = root.ownerDocument?.defaultView;

  return view?.matchMedia?.("(prefers-reduced-motion: reduce)") ?? {
    matches: false,
  };
}

function getIntersectionObserver(root) {
  return (
    root.ownerDocument?.defaultView?.IntersectionObserver ??
    globalThis.IntersectionObserver
  );
}

/**
 * Mount interactions owned exclusively by the landing sections.
 *
 * @param {Element} root
 * @returns {() => void}
 */
export function mountLandingSections(root) {
  if (!root || typeof root.querySelectorAll !== "function") {
    throw new Error("Landing sections root is missing.");
  }

  const reducedMotion = getReducedMotionQuery(root);
  const IntersectionObserverClass = getIntersectionObserver(root);
  const reveals = [...root.querySelectorAll("[data-reveal]")];
  const video = root.querySelector("[data-workflow-video]");
  const videoToggle = root.querySelector("[data-video-toggle]");
  let disposed = false;
  let videoInView = false;
  let userPaused = false;
  let userStartedVideo = false;
  let revealObserver;
  let videoObserver;

  const syncVideoToggle = () => updateVideoToggle(root);

  const playVideo = (force = false) => {
    if (
      !video ||
      (!force && (reducedMotion.matches || userPaused))
    ) {
      return;
    }

    try {
      const playResult = video.play();
      playResult?.catch?.(() => {
        userPaused = true;
        syncVideoToggle();
      });
    } catch {
      userPaused = true;
    }

    syncVideoToggle();
  };

  const updateVideoForViewport = () => {
    if (!video) {
      return;
    }

    if (!videoInView) {
      video.pause();
      syncVideoToggle();
      return;
    }

    if (!reducedMotion.matches && !userPaused) {
      playVideo();
    } else if (reducedMotion.matches && !userStartedVideo) {
      video.pause();
      syncVideoToggle();
    }
  };

  const handleVideoToggle = () => {
    if (!video) {
      return;
    }

    if (video.paused) {
      userPaused = false;
      userStartedVideo = true;
      playVideo(true);
    } else {
      userPaused = true;
      userStartedVideo = false;
      video.pause();
      syncVideoToggle();
    }
  };

  const handleReducedMotionChange = () => {
    updateVideoForViewport();
  };

  if (reducedMotion.matches || !IntersectionObserverClass) {
    for (const reveal of reveals) {
      reveal.classList.add("is-visible");
    }
  } else {
    revealObserver = new IntersectionObserverClass(
      (entries) => {
        if (disposed) {
          return;
        }

        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );

    for (const reveal of reveals) {
      revealObserver.observe(reveal);
    }
  }

  if (video && IntersectionObserverClass) {
    videoObserver = new IntersectionObserverClass(
      (entries) => {
        if (disposed) {
          return;
        }

        const entry = entries.find((candidate) => candidate.target === video);

        if (!entry) {
          return;
        }

        videoInView =
          entry.isIntersecting && entry.intersectionRatio >= 0.45;
        updateVideoForViewport();
      },
      { threshold: 0.45 },
    );
    videoObserver.observe(video);
  }

  videoToggle?.addEventListener("click", handleVideoToggle);
  video?.addEventListener("play", syncVideoToggle);
  video?.addEventListener("pause", syncVideoToggle);
  reducedMotion.addEventListener?.("change", handleReducedMotionChange);
  syncVideoToggle();

  return () => {
    if (disposed) {
      return;
    }

    disposed = true;
    revealObserver?.disconnect();
    videoObserver?.disconnect();
    videoToggle?.removeEventListener("click", handleVideoToggle);
    video?.removeEventListener("play", syncVideoToggle);
    video?.removeEventListener("pause", syncVideoToggle);
    reducedMotion.removeEventListener?.("change", handleReducedMotionChange);
  };
}

/**
 * Update localized landing-section copy without rebuilding the DOM.
 *
 * @param {Element} root
 * @param {Record<string, string>} copy
 */
export function updateLandingSectionsLocale(root, copy) {
  if (!root || typeof root.querySelectorAll !== "function") {
    throw new Error("Landing sections root is missing.");
  }

  for (const node of root.querySelectorAll("[data-section-copy]")) {
    const value = getCopyValue(copy, node.dataset.sectionCopy);

    if (value === null) {
      continue;
    }

    if (node.matches("video")) {
      node.setAttribute("aria-label", value);
    } else if (!node.matches("[data-video-label]")) {
      node.textContent = value;
    }
  }

  updateVideoCopy(root, copy);
}
