import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { installQuitGuard } from "../lib/quit-guard";
import { settings, updateSettings } from "../settings/settings-store";
import { resolveTheme, THEME_PRESETS } from "../settings/themes";
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
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--bg", theme.background ?? "#16161e");
    rootStyle.setProperty("--fg", theme.foreground ?? "#c0caf5");
    rootStyle.setProperty("--accent", theme.blue ?? "#7aa2f7");
    rootStyle.setProperty("--red", theme.red ?? "#f7768e");
    rootStyle.setProperty("--green", theme.green ?? "#9ece6a");
    rootStyle.setProperty("--yellow", theme.yellow ?? "#e0af68");
    rootStyle.setProperty("--magenta", theme.magenta ?? "#bb9af7");
    rootStyle.setProperty("--cyan", theme.cyan ?? "#7dcfff");
  });

  const closePanel = (): void => {
    panelOpen.value = false;
    tabsRef.current?.focusActive();
  };

  const cycleTheme = (): void => {
    const index = THEME_PRESETS.findIndex(
      (preset) => preset.id === settings.value.themeId,
    );
    const next = THEME_PRESETS[(index + 1) % THEME_PRESETS.length];
    // Switching theme clears previous color overrides
    updateSettings({ themeId: next.id, colorOverrides: {} });
  };

  return (
    <div class="window">
      <TabBar
        settingsOpen={panelOpen.value}
        onSelectTab={(index) => tabsRef.current?.selectTab(index)}
        onCloseTab={(index) => void tabsRef.current?.closeTab(index)}
        onNewTab={() => void tabsRef.current?.newTab()}
        onSplitRow={() => void tabsRef.current?.splitActive("row")}
        onSplitColumn={() => void tabsRef.current?.splitActive("column")}
        onClosePane={() => void tabsRef.current?.closePane()}
        onCycleTheme={cycleTheme}
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
