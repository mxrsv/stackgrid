import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installQuitGuard } from "../lib/quit-guard";
import { confirmClose, QUIT_COPY } from "../terminal/close-guard";
import { flushPendingSaves } from "../terminal/session-persistence";
import { defaultPtyClient } from "../terminal/pty-client";
import { deriveChromeColors } from "../lib/derive-colors";
import { resolveCwds, type Preset } from "../lib/preset-schema";
import { resolveInheritedCwds } from "../terminal/tab-materialize";
import { settings, updateSettings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import { createTabManager, type TabManager } from "../terminal/tab-manager";
import { tabViews } from "../terminal/tabs-store";
import {
  markLastUsed,
  presetsData,
  savePreset,
} from "../presets/presets-store";
import { recordWorkspaceOpen } from "../open-board/workspaces-store";
import { boardOpen, editorRequest, saveDialogOpen } from "../chrome/events";
import { OpenBoard } from "../open-board/open-board";
import { PresetEditor } from "../presets/preset-editor";
import {
  SavePresetDialog,
  type SaveTarget,
} from "../presets/save-preset-dialog";
import type { PresetArtifact } from "../presets/mock-model";
import { installAgentPicker } from "../agent-picker/agent-picker";
import { SkipAllBar } from "../agent-picker/skip-all-bar";
import { PersistErrorBar } from "../presets/persist-error-bar";
import { TabBar } from "./tab-bar";
import { StatusBar } from "./status-bar";
import { SettingsPanel } from "./settings-panel";

export function App() {
  const panelOpen = useSignal(false);
  const stagesRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<TabManager | null>(null);

  useEffect(() => {
    const host = stagesRef.current;
    if (!host) {
      return;
    }
    const manager = createTabManager(host);
    tabsRef.current = manager;
    manager
      .init()
      .then(({ hasTabs }) => {
        // No restorable session / restore off → Open board (FR-001)
        boardOpen.value = !hasTabs;
      })
      .catch((err: unknown) => {
        console.error("Failed to initialize terminals:", err);
        boardOpen.value = true;
      });
    const disposePicker = installAgentPicker(() => tabsRef.current);
    return () => {
      disposePicker();
      manager.dispose();
    };
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    installQuitGuard({
      // Quit is busy-guarded like every close path (FR-042 AC-3): silent
      // when all panes are idle, one confirm when anything is running.
      confirmQuit: () => {
        const manager = tabsRef.current;
        return manager
          ? confirmClose(manager.allPaneIds(), defaultPtyClient, QUIT_COPY)
          : Promise.resolve(true);
      },
      flush: flushPendingSaves,
      quit: () => defaultPtyClient.confirmQuit(),
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err: unknown) => {
        console.error("Failed to install quit guard:", err);
      });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const unsubs: UnlistenFn[] = [];
    void listen("menu:save-preset", () => {
      if (!boardOpen.value) {
        saveDialogOpen.value = true;
      }
    }).then((fn) => unsubs.push(fn));
    void listen("menu:new-preset", () => {
      editorRequest.value = { source: "live" };
    }).then((fn) => unsubs.push(fn));
    return () => unsubs.forEach((fn) => fn());
  }, []);

  // Push theme colors into terminals and the chrome CSS vars
  useSignalEffect(() => {
    const current = settings.value;
    tabsRef.current?.applySettings(current);
    const theme = resolveTheme(current);
    const bg = theme.background ?? "#16161e";
    const fg = theme.foreground ?? "#c0caf5";
    const chrome = deriveChromeColors(bg, fg);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--bg", bg);
    rootStyle.setProperty("--fg", fg);
    rootStyle.setProperty("--accent", theme.blue ?? "#7aa2f7");
    rootStyle.setProperty("--red", theme.red ?? "#f7768e");
    rootStyle.setProperty("--green", theme.green ?? "#9ece6a");
    rootStyle.setProperty("--yellow", theme.yellow ?? "#e0af68");
    rootStyle.setProperty("--magenta", theme.magenta ?? "#bb9af7");
    rootStyle.setProperty("--cyan", theme.cyan ?? "#7dcfff");
    rootStyle.setProperty("--tone", chrome.tone);
    rootStyle.setProperty("--chrome-1", chrome.chrome1);
    rootStyle.setProperty("--chrome-2", chrome.chrome2);
    rootStyle.setProperty("--tab-active-bg", chrome.tabActiveBg);
    rootStyle.setProperty("--input-bg", chrome.inputBg);
    rootStyle.setProperty("--hair", chrome.hair);
    rootStyle.setProperty("--hair-strong", chrome.hairStrong);
    rootStyle.setProperty("--text-primary", chrome.textPrimary);
    rootStyle.setProperty("--text-muted", chrome.textMuted);
    rootStyle.setProperty("--text-faint", chrome.textFaint);
  });

  const closePanel = (): void => {
    panelOpen.value = false;
    tabsRef.current?.focusActive();
  };

  /** Open board confirm: materialize + record recents + preselect memory. */
  async function handleOpen(
    workspace: string,
    preset: Preset,
  ): Promise<boolean> {
    const ok = await tabsRef.current?.openFromPreset(
      preset.layout,
      resolveCwds(preset, workspace),
    );
    if (ok) {
      recordWorkspaceOpen(workspace);
      markLastUsed(preset.id);
      boardOpen.value = false;
    }
    return ok ?? false;
  }

  /** Editor confirm (FR-015): save the preset, then materialize a new tab. */
  async function handleEditorCreate(
    name: string,
    artifact: PresetArtifact,
  ): Promise<void> {
    const preset: Preset = {
      id: crypto.randomUUID(),
      name,
      layout: artifact.layout,
      ...(artifact.cwds ? { cwds: artifact.cwds } : {}),
    };
    savePreset(preset);
    const request = editorRequest.value;
    editorRequest.value = null;
    if (request === null) {
      return;
    }
    if (request.source === "board") {
      if (request.workspace === null) {
        return; // gated like Open — board stays up showing the new card
      }
      await handleOpen(request.workspace, preset);
      return;
    }
    // Live window: inherit panes resolve to the focused pane's CWD (BF-Rule 8)
    const inherit = (await tabsRef.current?.activePaneCwd()) ?? null;
    await tabsRef.current?.openFromPreset(
      preset.layout,
      resolveInheritedCwds(preset.layout, preset.cwds, inherit),
    );
  }

  /** ⌘⇧S / menu: capture live layout into a new or existing preset (FR-012). */
  async function handleSavePreset(
    target: SaveTarget,
    includeCwds: boolean,
  ): Promise<void> {
    const captured = await tabsRef.current?.captureActiveLayout();
    saveDialogOpen.value = false;
    if (!captured) {
      return;
    }
    const cwds =
      includeCwds && captured.cwds.some((cwd) => cwd !== null)
        ? captured.cwds
        : undefined;
    if (target.kind === "new") {
      savePreset({
        id: crypto.randomUUID(),
        name: target.name,
        layout: captured.layout,
        ...(cwds ? { cwds } : {}),
      });
      return;
    }
    const existing = presetsData.value.presets.find(
      (preset) => preset.id === target.id,
    );
    if (existing) {
      savePreset({
        id: existing.id,
        name: existing.name,
        layout: captured.layout,
        ...(cwds ? { cwds } : {}),
      });
    }
  }

  return (
    <div class="window">
      <div
        class="titlebar"
        data-tauri-drag-region
        onDblClick={() => {
          getCurrentWindow()
            .toggleMaximize()
            .catch((err: unknown) => {
              console.warn("toggleMaximize failed:", err);
            });
        }}
      />
      <TabBar
        settingsOpen={panelOpen.value}
        onSelectTab={(index) => {
          boardOpen.value = false;
          tabsRef.current?.selectTab(index);
        }}
        onCloseTab={(index) => void tabsRef.current?.closeTab(index)}
        onNewTab={() => void tabsRef.current?.newTab()}
        onSplitRow={() => void tabsRef.current?.splitActive("row")}
        onSplitColumn={() => void tabsRef.current?.splitActive("column")}
        onClosePane={() => void tabsRef.current?.closePane()}
        onRenameTab={(index, name) => tabsRef.current?.renameTab(index, name)}
        onSetTabColor={(index, color) =>
          tabsRef.current?.setTabDotColor(index, color)
        }
        expandActive={settings.value.focusExpand}
        onToggleExpand={() =>
          updateSettings({ focusExpand: !settings.value.focusExpand })
        }
        onToggleSettings={() => {
          if (panelOpen.value) {
            closePanel();
          } else {
            panelOpen.value = true;
          }
        }}
      />
      <main class="stage">
        <div class="stage__tabs" ref={stagesRef} />
        {boardOpen.value ? (
          <OpenBoard
            canCancel={tabViews.value.length > 0}
            onCancel={() => {
              boardOpen.value = false;
              tabsRef.current?.focusActive();
            }}
            onOpen={(workspace, preset) => handleOpen(workspace, preset)}
            onNewPreset={(workspace) => {
              editorRequest.value = { source: "board", workspace };
            }}
          />
        ) : null}
        {editorRequest.value !== null ? (
          <PresetEditor
            onCancel={() => {
              editorRequest.value = null;
            }}
            onCreate={(name, artifact) =>
              void handleEditorCreate(name, artifact)
            }
          />
        ) : null}
        {saveDialogOpen.value ? (
          <SavePresetDialog
            existing={presetsData.value.presets}
            onCancel={() => {
              saveDialogOpen.value = false;
            }}
            onSave={(target, includeCwds) =>
              void handleSavePreset(target, includeCwds)
            }
          />
        ) : null}
        <SkipAllBar />
        <PersistErrorBar />
        <SettingsPanel open={panelOpen.value} onClose={closePanel} />
      </main>
      <StatusBar />
    </div>
  );
}
