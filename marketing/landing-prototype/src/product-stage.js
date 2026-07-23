/**
 * Hero stage data + stream engine — a mock of the real Stackgrid window.
 *
 * Everything in this module is intentionally English-only: the stage mirrors
 * the released app regardless of the landing locale (see the 2026-07-16 spec).
 */

export const deepFreeze = (value) => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
};

export const STAGE_ARIA_LABEL = "Stackgrid app window preview";

/** Sidebar workspace list — names and truncated paths as in the app. */
export const stageSidebar = deepFreeze([
  {
    id: "stackgrid",
    label: "stackgrid",
    path: "…rkspace/stackgrid",
    active: true,
    monogram: null,
    tint: null,
  },
  {
    id: "glowarena",
    label: "glowarena",
    path: "…rkspace/glowarena",
    active: false,
    monogram: "G",
    tint: "#bb9af7",
  },
  {
    id: "glow-workspace",
    label: "glow-workspace",
    path: "…nt/glow-workspace",
    active: false,
    monogram: "W",
    tint: "#7dcfff",
  },
  {
    id: "glow-api",
    label: "glow-api",
    path: "…rkspace/glow-api",
    active: false,
    monogram: "A",
    tint: "#9ece6a",
  },
]);

/** Status bar segments — mirrors src/ui/status-bar.tsx in sidebar mode. */
export const stageStatus = deepFreeze({
  branch: "main",
  cwd: "~/Documents/Development/glow-workspace/stackgrid",
  paneCount: "3 panes",
  theme: "Tokyo Night",
  hints: [
    { label: "split", key: "⌘D" },
    { label: "new tab", key: "⌘T" },
  ],
});

/**
 * Pane scripts. Step shape: { kind: "line" | "chunk" | "think" | "rest",
 * text?, cls?, delay } — delay is ms since the previous step. "line" appends
 * a transcript row (and hides the spinner), "chunk" extends the last row,
 * "think" shows the spinner with the given text, "rest" is a pure pause.
 */
export const stagePanes = deepFreeze([
  {
    id: "claude",
    focused: true,
    startOffset: 0,
    restGap: 4200,
    maxLines: 12,
    prompt: "❯",
    footer: [
      {
        text: "[Opus 4.8 (1M context)] ▮▮▮▯▯▯▯▯ 32% | stackgrid git:(main*)",
        cls: "t-dim",
      },
      { text: "▶▶ auto mode on (shift+tab to cycle)", cls: "t-dim" },
    ],
    steps: [
      {
        kind: "line",
        text: "● I'll trace why the pane divider drifts on resize.",
        cls: "t-body",
        delay: 600,
      },
      { kind: "think", text: "✳ Pondering… (esc to interrupt)", delay: 500 },
      {
        kind: "line",
        text: "● Read(src/terminal/layout-engine.ts)",
        cls: "t-tool",
        delay: 2200,
      },
      { kind: "line", text: "  ⎿ 312 lines", cls: "t-dim", delay: 450 },
      { kind: "think", text: "✳ Refining… (2s · ↓ 1.4k tokens)", delay: 700 },
      {
        kind: "line",
        text: "● The ratio rounds to integer cells before the flex",
        cls: "t-body",
        delay: 2600,
      },
      {
        kind: "chunk",
        text: " pass — resize twice and the drift compounds.",
        delay: 520,
      },
      {
        kind: "line",
        text: "● Update(src/terminal/layout-engine.ts)",
        cls: "t-tool",
        delay: 900,
      },
      {
        kind: "line",
        text: "  ⎿ +14 -6 · keep the fractional ratio in the tree",
        cls: "t-dim",
        delay: 500,
      },
      { kind: "think", text: "✳ Testing… (npm test)", delay: 800 },
      {
        kind: "line",
        text: "● 214 tests passed — the divider stays put now.",
        cls: "t-ok",
        delay: 2800,
      },
      { kind: "rest", delay: 1200 },
    ],
  },
  {
    id: "codex",
    focused: false,
    startOffset: 1300,
    restGap: 5200,
    maxLines: 10,
    prompt: "▌",
    footer: [{ text: "tokens used 4.2k · model gpt-5-codex", cls: "t-dim" }],
    steps: [
      {
        kind: "line",
        text: "› trace the flicker when a pane closes",
        cls: "t-user",
        delay: 900,
      },
      { kind: "think", text: "• Working (2s · esc to interrupt)", delay: 600 },
      { kind: "line", text: "codex", cls: "t-agent", delay: 2400 },
      {
        kind: "line",
        text: "The old pane's canvas paints one frame after the",
        cls: "t-body",
        delay: 420,
      },
      {
        kind: "chunk",
        text: " grid reflows. I'll defer the removal by a frame.",
        delay: 480,
      },
      {
        kind: "line",
        text: "✓ Applied patch src/terminal/pane-lifecycle.ts",
        cls: "t-ok",
        delay: 1200,
      },
      {
        kind: "line",
        text: "  └ requestAnimationFrame before detach",
        cls: "t-dim",
        delay: 460,
      },
      { kind: "think", text: "• Verifying (vitest run)", delay: 700 },
      {
        kind: "line",
        text: "✓ 96 passed · 0 failed",
        cls: "t-ok",
        delay: 2400,
      },
      { kind: "rest", delay: 1000 },
    ],
  },
  {
    id: "opencode",
    focused: false,
    startOffset: 2600,
    restGap: 4800,
    maxLines: 18,
    prompt: ">",
    footer: [
      { text: "opencode · claude-sonnet-5 · 12.4k tokens", cls: "t-dim" },
    ],
    steps: [
      {
        kind: "line",
        text: "> why does the status bar lose the branch after cd?",
        cls: "t-user",
        delay: 1100,
      },
      { kind: "think", text: "◍ thinking…", delay: 600 },
      {
        kind: "line",
        text: "The watcher only re-reads HEAD on focus. A cwd",
        cls: "t-body",
        delay: 2300,
      },
      {
        kind: "chunk",
        text: " change from OSC 7 should also trigger it.",
        delay: 500,
      },
      {
        kind: "line",
        text: "edit src/lib/git-status.ts",
        cls: "t-tool",
        delay: 1100,
      },
      {
        kind: "line",
        text: "  + watch cwd from osc-7 events",
        cls: "t-dim",
        delay: 450,
      },
      { kind: "think", text: "◍ running checks…", delay: 700 },
      {
        kind: "line",
        text: "✓ typecheck clean · the branch follows cwd now",
        cls: "t-ok",
        delay: 2500,
      },
      { kind: "rest", delay: 1200 },
    ],
  },
]);

function appendLine(linesEl, step, maxLines) {
  const line = document.createElement("div");
  line.className = `a-appwin__line${step.cls ? ` ${step.cls}` : ""}`;
  line.textContent = step.text ?? "";
  linesEl.append(line);

  while (linesEl.childElementCount > maxLines) {
    linesEl.firstElementChild?.remove();
  }
}

function applyStep(step, linesEl, spinnerEl, maxLines) {
  if (step.kind === "line") {
    spinnerEl.hidden = true;
    appendLine(linesEl, step, maxLines);
    return;
  }

  if (step.kind === "chunk") {
    const last = linesEl.lastElementChild;

    if (last === null) {
      appendLine(linesEl, step, maxLines);
    } else {
      last.textContent += step.text ?? "";
    }

    return;
  }

  if (step.kind === "think") {
    spinnerEl.textContent = step.text ?? "";
    spinnerEl.hidden = false;
  }
  // "rest" is a pure delay — nothing to apply.
}

/** Render the completed frame in one shot (reduced-motion path). */
function renderStaticFrame(pane, linesEl, spinnerEl) {
  spinnerEl.hidden = true;

  for (const step of pane.steps) {
    if (step.kind === "line" || step.kind === "chunk") {
      applyStep(step, linesEl, spinnerEl, pane.maxLines);
    }
  }
}

function runPane(pane, linesEl, spinnerEl) {
  let timerId = null;
  let disposed = false;
  let index = 0;
  let dueAt = performance.now() + pane.startOffset + pane.steps[0].delay;

  function tick() {
    if (disposed) {
      return;
    }

    const now = performance.now();

    // Apply every step already due in one pass — a throttled background
    // tab catches up without a visible animation burst.
    while (index < pane.steps.length && dueAt <= now) {
      applyStep(pane.steps[index], linesEl, spinnerEl, pane.maxLines);
      index += 1;

      if (index < pane.steps.length) {
        dueAt += pane.steps[index].delay;
      }
    }

    if (index >= pane.steps.length) {
      // Loop without clearing: the next cycle's lines push the old ones out
      // through the maxLines cap, so the pane always reads as live work.
      timerId = setTimeout(() => {
        if (disposed) {
          return;
        }

        spinnerEl.hidden = true;
        index = 0;
        dueAt = performance.now() + pane.steps[0].delay;
        tick();
      }, pane.restGap);
      return;
    }

    timerId = setTimeout(tick, Math.max(16, dueAt - now));
  }

  timerId = setTimeout(tick, Math.max(0, dueAt - performance.now()));

  return () => {
    disposed = true;
    clearTimeout(timerId);
  };
}

/**
 * Start the streaming simulation inside the stage's pane grid.
 *
 * @param {HTMLElement} gridRoot element containing one `[data-stream]`
 *   transcript region per pane (each with `[data-lines]` + `[data-spinner]`)
 * @returns {() => void} dispose — cancels every pending timer
 */
export function mountStageStream(gridRoot) {
  if (!gridRoot) {
    throw new Error("Stage grid root is missing.");
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const disposers = [];

  for (const pane of stagePanes) {
    const region = gridRoot.querySelector(`[data-stream="${pane.id}"]`);
    const linesEl = region?.querySelector("[data-lines]");
    const spinnerEl = region?.querySelector("[data-spinner]");

    if (!linesEl || !spinnerEl) {
      throw new Error(`Stage pane "${pane.id}" markup is missing.`);
    }

    // Seed the completed frame in both paths so no pane ever sits empty;
    // with motion enabled the stream keeps appending on top of it.
    renderStaticFrame(pane, linesEl, spinnerEl);

    if (!reduceMotion.matches) {
      disposers.push(runPane(pane, linesEl, spinnerEl));
    }
  }

  return () => {
    disposers.forEach((dispose) => dispose());
  };
}

/**
 * Mount the shared, user-triggered product demo dialog.
 *
 * @param {HTMLElement} host
 * @param {HTMLElement} triggerRoot
 * @returns {() => void}
 */
export function mountDemoDialog(host, triggerRoot) {
  const dialog = document.createElement("dialog");
  dialog.className = "demo-dialog";
  dialog.setAttribute("aria-labelledby", "demo-dialog-title");
  dialog.innerHTML = `
    <div class="demo-dialog__header">
      <h2 id="demo-dialog-title">Stackgrid Focus Expand demo</h2>
      <button type="button" data-close-demo aria-label="Close demo">Close</button>
    </div>
    <video controls muted loop playsinline poster="/stackgrid-cmd-e-poster.png"
      aria-label="Stackgrid Focus Expand demo">
      <source src="/stackgrid-cmd-e.webm" type="video/webm" />
      <source src="/stackgrid-cmd-e.mp4" type="video/mp4" />
      Your browser does not support HTML video.
    </video>
  `;

  const video = dialog.querySelector("video");
  const closeButton = dialog.querySelector("[data-close-demo]");
  const triggers = [...triggerRoot.querySelectorAll("[data-open-demo]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let opener = null;

  if (!video || !closeButton) {
    throw new Error("Demo dialog controls are missing.");
  }

  function resetVideo() {
    video.pause();
    video.currentTime = 0;
  }

  function handleTriggerClick(event) {
    opener = event.currentTarget;
    dialog.showModal();

    if (!reduceMotion.matches) {
      const playAttempt = video.play();
      playAttempt?.catch(() => {});
    }
  }

  function handleCloseButtonClick() {
    dialog.close();
  }

  function handleCancel(event) {
    event.preventDefault();
    dialog.close();
  }

  function handleClose() {
    resetVideo();

    if (opener?.isConnected) {
      opener.focus();
    }

    opener = null;
  }

  host.append(dialog);
  triggers.forEach((trigger) =>
    trigger.addEventListener("click", handleTriggerClick),
  );
  closeButton.addEventListener("click", handleCloseButtonClick);
  dialog.addEventListener("cancel", handleCancel);
  dialog.addEventListener("close", handleClose);

  return () => {
    triggers.forEach((trigger) =>
      trigger.removeEventListener("click", handleTriggerClick),
    );
    closeButton.removeEventListener("click", handleCloseButtonClick);
    dialog.removeEventListener("cancel", handleCancel);
    dialog.removeEventListener("close", handleClose);
    resetVideo();
    dialog.remove();
  };
}
