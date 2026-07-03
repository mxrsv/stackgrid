import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { installQuitGuard } from "../lib/quit-guard";
import { settings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import { createTabManager, type TabManager } from "../terminal/tab-manager";
import { Sidebar } from "./sidebar";
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

  // Apply settings to terminals + app chrome CSS vars whenever settings change
  useSignalEffect(() => {
    const current = settings.value;
    tabsRef.current?.applySettings(current);
    const theme = resolveTheme(current);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--app-bg", theme.background ?? "#16161e");
    rootStyle.setProperty("--app-fg", theme.foreground ?? "#c0caf5");
    rootStyle.setProperty("--accent", theme.blue ?? "#7aa2f7");
  });

  const closePanel = (): void => {
    panelOpen.value = false;
    tabsRef.current?.focusActive();
  };

  return (
    <div class="app app--left">
      <Sidebar
        position="left"
        settingsOpen={panelOpen.value}
        onToggleSettings={() => {
          if (panelOpen.value) {
            closePanel();
          } else {
            panelOpen.value = true;
          }
        }}
        onSplitRow={() => void tabsRef.current?.splitActive("row")}
        onSplitColumn={() => void tabsRef.current?.splitActive("column")}
        onClosePane={() => void tabsRef.current?.closePane()}
      />
      <div class="app__main">
        {panelOpen.value && <SettingsPanel onClose={closePanel} />}
        <div class="terminal-container" ref={stagesRef} />
      </div>
    </div>
  );
}
