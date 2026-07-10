import { invoke } from "@tauri-apps/api/core";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { open } from "@tauri-apps/plugin-dialog";
import { countLeaves } from "../lib/split-tree";
import { isBuiltIn, type Preset } from "../lib/preset-schema";
import { folderName, formatRelativeTime } from "../lib/workspace-recents";
import {
  boardPresets,
  deletePreset,
  presetsData,
  renamePreset,
} from "../presets/presets-store";
import { workspacesData } from "./workspaces-store";
import { PresetThumb } from "../presets/preset-thumb";

export interface OpenBoardProps {
  canCancel: boolean;
  onCancel(): void;
  /** Resolves to false on failure (e.g. PTY spawn error) — board stays up. */
  onOpen(workspace: string, preset: Preset): Promise<boolean>;
  onNewPreset(workspace: string | null): void;
}

type BoardColumn = "workspace" | "preset";

export function OpenBoard({
  canCancel,
  onCancel,
  onOpen,
  onNewPreset,
}: OpenBoardProps) {
  const recents = workspacesData.value.recents;
  const presets = boardPresets();
  const selectedPath = useSignal<string | null>(recents[0]?.path ?? null);
  const selectedPresetId = useSignal<string>(
    presetsData.value.lastUsedId ?? presets[0].id,
  );
  const column = useSignal<BoardColumn>("workspace");
  const missing = useSignal<ReadonlySet<string>>(new Set());
  const renamingId = useSignal<string | null>(null);
  const renameValue = useSignal("");
  const confirmDeleteId = useSignal<string | null>(null);
  const opening = useSignal(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const paths = recents.map((recent) => recent.path);
    if (paths.length === 0) {
      return;
    }
    invoke<boolean[]>("dirs_exist", { paths })
      .then((flags) => {
        missing.value = new Set(paths.filter((_, index) => !flags[index]));
      })
      .catch((err: unknown) => {
        console.warn("dirs_exist failed:", err);
      });
  }, [recents]);

  const selectedPreset =
    presets.find((preset) => preset.id === selectedPresetId.value) ??
    presets[0];
  const workspaceValid =
    selectedPath.value !== null && !missing.value.has(selectedPath.value);

  async function pickFolder(): Promise<void> {
    try {
      const picked = await open({ directory: true, multiple: false });
      if (typeof picked === "string") {
        selectedPath.value = picked;
      }
    } catch (err: unknown) {
      console.warn("Folder picker failed:", err);
    }
  }

  /** Guards against a second Open (button/Enter/double-click) firing while
   * the first one is still spawning panes — that would materialize two tabs
   * from one confirm. Only resets on failure; success unmounts the board. */
  async function confirmOpen(): Promise<void> {
    if (!workspaceValid || selectedPath.value === null || opening.value) {
      return;
    }
    opening.value = true;
    const ok = await onOpen(selectedPath.value, selectedPreset);
    if (!ok) {
      opening.value = false;
    }
  }

  function moveSelection(step: 1 | -1): void {
    if (column.value === "workspace") {
      const selectable = recents.filter((r) => !missing.value.has(r.path));
      if (selectable.length === 0) {
        return;
      }
      const index = selectable.findIndex(
        (r) => r.path === selectedPath.value,
      );
      const next =
        selectable[
          (index + step + selectable.length) % selectable.length
        ];
      selectedPath.value = next.path;
      return;
    }
    const index = presets.findIndex((p) => p.id === selectedPresetId.value);
    const next = presets[(index + step + presets.length) % presets.length];
    selectedPresetId.value = next.id;
  }

  function startRename(preset: Preset): void {
    if (isBuiltIn(preset)) {
      return;
    }
    renamingId.value = preset.id;
    renameValue.value = preset.name;
    confirmDeleteId.value = null;
  }

  function commitRename(): void {
    const id = renamingId.value;
    const name = renameValue.value.trim();
    if (id !== null && name !== "") {
      renamePreset(id, name);
    }
    renamingId.value = null;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) {
      return; // rename input owns its keys (Enter/Esc handled inline)
    }
    switch (event.key) {
      case "ArrowUp":
        moveSelection(-1);
        break;
      case "ArrowDown":
        moveSelection(1);
        break;
      case "ArrowLeft":
      case "ArrowRight":
      case "Tab":
        column.value =
          column.value === "workspace" ? "preset" : "workspace";
        break;
      case "Enter":
        void confirmOpen();
        break;
      case "Escape":
        if (confirmDeleteId.value !== null) {
          confirmDeleteId.value = null;
        } else if (canCancel) {
          onCancel();
        }
        break;
      case "o":
        if (event.metaKey) {
          void pickFolder();
        } else {
          return;
        }
        break;
      case "r":
        if (column.value === "preset") {
          startRename(selectedPreset);
        }
        break;
      case "Backspace":
        if (column.value === "preset" && !isBuiltIn(selectedPreset)) {
          confirmDeleteId.value = selectedPreset.id;
        }
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      class="open-board"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={containerRef}
    >
      <header class="open-board__header">
        <h1>New window</h1>
        <p>Pick a workspace folder and a layout — then open a tab.</p>
      </header>
      <div class="open-board__columns">
        <section
          class={`open-board__col ${column.value === "workspace" ? "is-focused" : ""}`}
        >
          <h2 class="open-board__col-title">
            Workspace <span>recent folders</span>
          </h2>
          <ul class="workspace-list">
            {recents.map((recent) => {
              const gone = missing.value.has(recent.path);
              return (
                <li key={recent.path}>
                  <button
                    class={`workspace-row ${recent.path === selectedPath.value ? "is-selected" : ""} ${gone ? "is-missing" : ""}`}
                    disabled={gone}
                    onClick={() => {
                      selectedPath.value = recent.path;
                      column.value = "workspace";
                    }}
                  >
                    <span class="workspace-row__name">
                      {folderName(recent.path)}
                      {gone ? <em> — missing</em> : null}
                    </span>
                    <span class="workspace-row__path">{recent.path}</span>
                    <span class="workspace-row__time">
                      {formatRelativeTime(recent.lastOpenedAt, Date.now())}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button class="workspace-open-folder" onClick={() => void pickFolder()}>
            ＋ Open Folder…
          </button>
          {selectedPath.value !== null &&
          !recents.some((r) => r.path === selectedPath.value) ? (
            <p class="workspace-picked">{selectedPath.value}</p>
          ) : null}
        </section>
        <section
          class={`open-board__col ${column.value === "preset" ? "is-focused" : ""}`}
        >
          <h2 class="open-board__col-title">
            Layout preset <span>split + CWD</span>
          </h2>
          <div class="preset-grid">
            {presets.map((preset) => (
              <div
                key={preset.id}
                class={`preset-card ${preset.id === selectedPresetId.value ? "is-selected" : ""}`}
                onClick={() => {
                  selectedPresetId.value = preset.id;
                  column.value = "preset";
                }}
                onDblClick={() => void confirmOpen()}
                onContextMenu={(event) => {
                  event.preventDefault();
                  startRename(preset);
                }}
              >
                <PresetThumb layout={preset.layout} />
                {renamingId.value === preset.id ? (
                  <input
                    class="preset-card__rename"
                    value={renameValue.value}
                    ref={(el) => el?.focus()}
                    onInput={(event) => {
                      renameValue.value = (
                        event.target as HTMLInputElement
                      ).value;
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitRename();
                      }
                      if (event.key === "Escape") {
                        renamingId.value = null;
                      }
                      event.stopPropagation();
                    }}
                    onBlur={commitRename}
                  />
                ) : (
                  <span class="preset-card__name">{preset.name}</span>
                )}
                <span class="preset-card__meta">
                  {countLeaves(preset.layout)}{" "}
                  {countLeaves(preset.layout) === 1 ? "pane" : "panes"}
                  {preset.cwds ? " · CWDs" : ""}
                  {isBuiltIn(preset) ? " · BUILT-IN" : ""}
                </span>
                {confirmDeleteId.value === preset.id ? (
                  <span class="preset-card__confirm">
                    Delete?
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deletePreset(preset.id);
                        confirmDeleteId.value = null;
                        if (selectedPresetId.value === preset.id) {
                          selectedPresetId.value = presets[0].id;
                        }
                      }}
                    >
                      Delete
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmDeleteId.value = null;
                      }}
                    >
                      Keep
                    </button>
                  </span>
                ) : null}
              </div>
            ))}
            <button
              class="preset-card preset-card--new"
              onClick={() => onNewPreset(selectedPath.value)}
            >
              ＋ New preset…
            </button>
          </div>
        </section>
      </div>
      <footer class="open-board__footer">
        <span
          class={`open-board__summary ${workspaceValid ? "" : "is-warning"}`}
        >
          {workspaceValid && selectedPath.value !== null ? (
            <>
              Open <strong>{folderName(selectedPath.value)}</strong> as{" "}
              <strong>{selectedPreset.name}</strong>
            </>
          ) : (
            "Select a workspace folder"
          )}
        </span>
        <div class="open-board__actions">
          <button onClick={onCancel} disabled={!canCancel}>
            Cancel
          </button>
          <button
            class="is-primary"
            onClick={() => void confirmOpen()}
            disabled={!workspaceValid || opening.value}
          >
            {opening.value ? "Opening…" : "Open"}
          </button>
        </div>
      </footer>
    </div>
  );
}
