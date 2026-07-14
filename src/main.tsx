import { render } from "preact";
import "@xterm/xterm/css/xterm.css";
import "./styles.css";
import { initSettings } from "./settings/settings-store";
import { initPresets } from "./presets/presets-store";
import { initWorkspaces } from "./open-board/workspaces-store";
import { App } from "./ui/app";
import { ErrorBoundary } from "./ui/error-boundary";

// Last-resort net: async errors that never touch a React/Preact render tree
// (rejected promises outside any .catch chain, errors thrown from timers,
// event handlers, etc.) are otherwise invisible in a packaged app with no
// devtools open. Log them so they always show up somewhere instead of
// silently vanishing.
window.addEventListener("error", (event) => {
  console.error("[window.onerror]", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandledrejection]", event.reason);
});

function renderFatalStartupError(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "crash-boundary";
  wrap.innerHTML = `
    <div class="crash-boundary__card">
      <p class="crash-boundary__eyebrow">Stackgrid không khởi động được</p>
      <h1>Lỗi khi tải dữ liệu ban đầu</h1>
      <p class="crash-boundary__detail"></p>
    </div>`;
  wrap.querySelector(".crash-boundary__detail")!.textContent = message;
  root.appendChild(wrap);
}

async function main(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("#root element not found");
  }
  try {
    await initSettings();
    await Promise.all([initPresets(), initWorkspaces()]);
  } catch (error) {
    // initSettings/initPresets/initWorkspaces already degrade internally on
    // known failure modes; this only fires for something truly unexpected.
    // Fail visibly instead of leaving a blank window.
    console.error("[startup] Unexpected init failure:", error);
    renderFatalStartupError(root, error);
    return;
  }
  render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
    root,
  );
}

main().catch((error: unknown) => {
  console.error("[startup] Unhandled main() failure:", error);
  const root = document.getElementById("root");
  if (root) renderFatalStartupError(root, error);
});
