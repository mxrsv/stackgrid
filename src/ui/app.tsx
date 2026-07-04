import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installQuitGuard } from "../lib/quit-guard";
import { deriveChromeColors } from "../lib/derive-colors";
import { settings, updateSettings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import { createTabManager, type TabManager } from "../terminal/tab-manager";
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
    manager.init().catch((err: unknown) => {
      console.error("Failed to initialize terminals:", err);
    });
    return () => manager.dispose();
  }, []);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    installQuitGuard()
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err: unknown) => {
        console.error("Failed to install quit guard:", err);
      });
    return () => unlisten?.();
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
        onSelectTab={(index) => tabsRef.current?.selectTab(index)}
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
        <SettingsPanel open={panelOpen.value} onClose={closePanel} />
      </main>
      <StatusBar />
    </div>
  );
}
