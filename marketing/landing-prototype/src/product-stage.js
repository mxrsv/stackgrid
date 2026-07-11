const freezePane = (pane) =>
  Object.freeze({
    ...pane,
    lines: Object.freeze([...pane.lines]),
  });

export const agentPanes = Object.freeze(
  [
    {
      id: "claude",
      agent: "Claude Code",
      process: "claude",
      cwd: "~/work/stackgrid",
      lines: ["Read src/terminal/layout-engine.ts", "Refining split ratio…"],
      accent: "#d9ff70",
    },
    {
      id: "codex",
      agent: "Codex",
      process: "codex",
      cwd: "~/work/stackgrid",
      lines: ["Inspect src/terminal/pane.ts", "Checking pane state…"],
      accent: "#70e1ff",
    },
    {
      id: "gemini",
      agent: "Gemini CLI",
      process: "gemini",
      cwd: "~/work/stackgrid",
      lines: ["Review src/lib/process-info.ts", "Tracing focus behavior…"],
      accent: "#a98bff",
    },
    {
      id: "shell",
      agent: "Shell",
      process: "zsh",
      cwd: "~/work/stackgrid",
      lines: ["git status --short", "npm run build"],
      accent: "#ff9f70",
    },
  ].map(freezePane),
);

export const sequenceSteps = Object.freeze(
  [
    { label: "preset", number: "01" },
    { label: "grid", number: "02" },
    { label: "focus", number: "03" },
  ].map(Object.freeze),
);

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
