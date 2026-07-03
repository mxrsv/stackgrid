import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { installQuitGuard } from "../lib/quit-guard";
import { settings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import {
  createTerminalManager,
  type TerminalManager,
} from "../terminal/terminal-manager";
import { Sidebar } from "./sidebar";
import { SettingsPanel } from "./settings-panel";

export function App() {
  const panelOpen = useSignal(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<TerminalManager | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const manager = createTerminalManager();
    managerRef.current = manager;
    manager.init(container).catch((err: unknown) => {
      console.error("Failed to initialize terminal:", err);
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
    managerRef.current?.applySettings(current);
    const theme = resolveTheme(current);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--app-bg", theme.background ?? "#16161e");
    rootStyle.setProperty("--app-fg", theme.foreground ?? "#c0caf5");
    rootStyle.setProperty("--accent", theme.blue ?? "#7aa2f7");
  });

  const closePanel = (): void => {
    panelOpen.value = false;
    managerRef.current?.focusActive();
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
        onSplitRow={() => void managerRef.current?.splitActive("row")}
        onSplitColumn={() => void managerRef.current?.splitActive("column")}
        onClosePane={() => void managerRef.current?.closeActive()}
      />
      <div class="app__main">
        {panelOpen.value && <SettingsPanel onClose={closePanel} />}
        <div class="terminal-container" ref={containerRef} />
      </div>
    </div>
  );
}
