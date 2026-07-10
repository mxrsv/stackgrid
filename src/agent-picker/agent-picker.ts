import { invoke } from "@tauri-apps/api/core";
import { effect } from "@preact/signals";
import {
  beginPick,
  detectedAgents,
  pendingPaneIds,
  resolvePane,
  type DetectedAgent,
} from "./picker-store";

export interface PickerHost {
  paneOverlayHost(id: number): HTMLElement | null;
}

/** Human names for allowlisted binaries (icon column uses the first letter). */
const AGENT_LABELS: Readonly<Record<string, string>> = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
};

/** Detect agents through the login shell, then mark the panes pending. */
export async function beginAgentPick(
  paneIds: readonly number[],
): Promise<void> {
  if (paneIds.length === 0) {
    return;
  }
  try {
    detectedAgents.value = await invoke<DetectedAgent[]>("detect_agents");
  } catch (err: unknown) {
    console.warn("detect_agents failed:", err);
    detectedAgents.value = []; // card degrades to Shell only (FR-025)
  }
  beginPick(paneIds);
}

/** Pick = spawn the command immediately in the pane's shell (FR-022). */
function pickAgent(id: number, agent: DetectedAgent): void {
  invoke("write_pty", { id, data: `${agent.name}\r` }).catch(
    (err: unknown) => {
      console.error("write_pty failed:", err);
    },
  );
  resolvePane(id);
}

interface CardOption {
  readonly hint: string;
  readonly label: string;
  readonly command: string;
  readonly onPick: () => void;
}

function buildCard(
  id: number,
  agents: readonly DetectedAgent[],
): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "agent-picker";
  const card = document.createElement("div");
  card.className = "agent-picker__card";
  card.tabIndex = 0;

  const title = document.createElement("h1");
  title.textContent = "Run an agent";
  const subtitle = document.createElement("p");
  subtitle.textContent =
    agents.length > 0
      ? "Detected on $PATH · pick spawns immediately"
      : "No agent CLIs found on $PATH";
  card.append(title, subtitle);

  const options: CardOption[] = [
    ...agents.map((agent, index) => ({
      hint: String(index + 1),
      label: AGENT_LABELS[agent.name] ?? agent.name,
      command: agent.name,
      onPick: () => pickAgent(id, agent),
    })),
    {
      hint: "0",
      label: "Shell only",
      command: "$SHELL",
      onPick: () => resolvePane(id), // idle login shell stays (FR-023)
    },
  ];

  let focused = 0;
  const rows = options.map((option, index) => {
    const row = document.createElement("button");
    row.className = "agent-picker__option";
    if (index === options.length - 1) {
      row.classList.add("is-shell");
    }
    const hint = document.createElement("kbd");
    hint.textContent = option.hint;
    const label = document.createElement("span");
    label.textContent = option.label;
    const command = document.createElement("code");
    command.textContent = option.command;
    row.append(hint, label, command);
    row.addEventListener("click", option.onPick);
    return row;
  });
  card.append(...rows);

  function paintFocus(): void {
    rows.forEach((row, index) => {
      row.classList.toggle("is-focused", index === focused);
    });
  }
  paintFocus();

  card.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      focused = (focused + 1) % options.length;
      paintFocus();
    } else if (event.key === "ArrowUp") {
      focused = (focused - 1 + options.length) % options.length;
      paintFocus();
    } else if (event.key === "Enter" && !event.metaKey) {
      options[focused].onPick();
    } else if (event.key === "0") {
      options[options.length - 1].onPick();
    } else if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < agents.length) {
        options[index].onPick();
      }
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });

  overlay.addEventListener("mousedown", () => card.focus());
  overlay.appendChild(card);
  return overlay;
}

/**
 * Keep one overlay card per pending pane. Effect re-runs on store changes;
 * cards attach to pane elements so they survive layout re-renders. Returns
 * a disposer.
 */
export function installAgentPicker(
  getHost: () => PickerHost | null,
): () => void {
  const cards = new Map<number, HTMLElement>();
  const disposeEffect = effect(() => {
    const pending = new Set(pendingPaneIds.value);
    const agents = detectedAgents.value;
    for (const [id, overlay] of [...cards]) {
      if (!pending.has(id)) {
        overlay.remove();
        cards.delete(id);
      }
    }
    // Session restore can bring back several tabs at once — only tab is
    // shown (others sit at `display: none`), so `.focus()` on a card in a
    // hidden tab is a DOM no-op. Focus the first NEW card that's actually
    // visible, so keyboard selection works without requiring a click first.
    let firstVisibleNew: HTMLElement | null = null;
    for (const id of pending) {
      if (cards.has(id)) {
        continue;
      }
      const host = getHost()?.paneOverlayHost(id);
      if (host === null || host === undefined) {
        continue; // pane vanished — prune comes from the layout callback
      }
      const overlay = buildCard(id, agents);
      host.appendChild(overlay);
      cards.set(id, overlay);
      if (firstVisibleNew === null && host.offsetParent !== null) {
        firstVisibleNew = overlay;
      }
    }
    firstVisibleNew
      ?.querySelector<HTMLElement>(".agent-picker__card")
      ?.focus();
  });
  return () => {
    disposeEffect();
    for (const overlay of cards.values()) {
      overlay.remove();
    }
    cards.clear();
  };
}
