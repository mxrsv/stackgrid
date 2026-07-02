import { useEffect, useRef } from "preact/hooks";
import { useSignal, useSignalEffect } from "@preact/signals";
import { settings } from "../settings/settings-store";
import { resolveTheme } from "../settings/themes";
import {
  createTerminalController,
  type TerminalController,
} from "../terminal/terminal";
import { Sidebar } from "./sidebar";
import { SettingsPanel } from "./settings-panel";

export function App() {
  const panelOpen = useSignal(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TerminalController | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const controller = createTerminalController(settings.value);
    controllerRef.current = controller;
    void controller.attach(container);
  }, []);

  // Áp settings vào terminal + CSS vars của app chrome mỗi khi settings đổi
  useSignalEffect(() => {
    const current = settings.value;
    controllerRef.current?.applySettings(current);
    const theme = resolveTheme(current);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--app-bg", theme.background ?? "#16161e");
    rootStyle.setProperty("--app-fg", theme.foreground ?? "#c0caf5");
    rootStyle.setProperty("--accent", theme.blue ?? "#7aa2f7");
  });

  const closePanel = (): void => {
    panelOpen.value = false;
    controllerRef.current?.focus();
  };

  return (
    <div class={`app app--${settings.value.sidebarPosition}`}>
      <Sidebar
        position={settings.value.sidebarPosition}
        settingsOpen={panelOpen.value}
        onToggleSettings={() => {
          if (panelOpen.value) {
            closePanel();
          } else {
            panelOpen.value = true;
          }
        }}
      />
      <div class="app__main">
        {panelOpen.value && <SettingsPanel onClose={closePanel} />}
        <div class="terminal-container" ref={containerRef} />
      </div>
    </div>
  );
}
