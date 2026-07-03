import type { SidebarPosition } from "../settings/settings-schema";

interface SidebarProps {
  position: SidebarPosition;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onSplitRow: () => void;
  onSplitColumn: () => void;
  onClosePane: () => void;
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03Z" />
    </svg>
  );
}

function SplitRowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <line x1="12" y1="4.5" x2="12" y2="19.5" />
    </svg>
  );
}

function SplitColumnIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
    </svg>
  );
}

function ClosePaneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 9.5l5 5m0-5l-5 5" />
    </svg>
  );
}

export function Sidebar({
  position,
  settingsOpen,
  onToggleSettings,
  onSplitRow,
  onSplitColumn,
  onClosePane,
}: SidebarProps) {
  return (
    <nav class={`sidebar sidebar--${position}`} aria-label="Toolbar">
      <button
        type="button"
        class="sidebar__button"
        title="Split vertically (⌘D)"
        aria-label="Split pane vertically"
        onClick={onSplitRow}
      >
        <SplitRowIcon />
      </button>
      <button
        type="button"
        class="sidebar__button"
        title="Split horizontally (⌘⇧D)"
        aria-label="Split pane horizontally"
        onClick={onSplitColumn}
      >
        <SplitColumnIcon />
      </button>
      <button
        type="button"
        class="sidebar__button"
        title="Close pane (⌘⇧W)"
        aria-label="Close current pane"
        onClick={onClosePane}
      >
        <ClosePaneIcon />
      </button>
      <span class="sidebar__spacer" aria-hidden="true" />
      <button
        type="button"
        class={`sidebar__button sidebar__button--gear ${settingsOpen ? "is-active" : ""}`}
        title="Settings"
        aria-label="Open settings"
        aria-pressed={settingsOpen}
        onClick={onToggleSettings}
      >
        <GearIcon />
      </button>
    </nav>
  );
}
