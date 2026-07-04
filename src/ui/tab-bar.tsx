import { useSignal } from "@preact/signals";
import { activeTabIndex, tabViews } from "../terminal/tabs-store";
import { dotColor } from "../lib/process-info";
import { tabDotCssColor, type TabDotColor } from "../lib/tab-colors";
import { TabPopover } from "./tab-popover";

interface TabBarProps {
  settingsOpen: boolean;
  onSelectTab(index: number): void;
  onCloseTab(index: number): void;
  onNewTab(): void;
  onSplitRow(): void;
  onSplitColumn(): void;
  onClosePane(): void;
  onRenameTab(index: number, name: string | null): void;
  onSetTabColor(index: number, color: TabDotColor | null): void;
  onToggleSettings(): void;
  expandActive: boolean;
  onToggleExpand(): void;
}

function SplitRowIcon() {
  return (
    <svg
      width="13"
      height="13"
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
      width="13"
      height="13"
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
      width="13"
      height="13"
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

function ExpandIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4.5H6a1.5 1.5 0 0 0-1.5 1.5v3" />
      <path d="M15 4.5h3a1.5 1.5 0 0 1 1.5 1.5v3" />
      <path d="M9 19.5H6A1.5 1.5 0 0 1 4.5 18v-3" />
      <path d="M15 19.5h3a1.5 1.5 0 0 0 1.5-1.5v-3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="13"
      height="13"
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

export function TabBar(props: TabBarProps) {
  const tabs = tabViews.value;
  const active = activeTabIndex.value;
  // Anchored by tab key, not index — tabs can close (and indexes shift)
  // while the popover is open; actions resolve the index at call time.
  const popover = useSignal<{
    key: number;
    left: number;
    top: number;
    anchorEl: HTMLElement;
  } | null>(null);
  const popoverTab =
    popover.value === null
      ? undefined
      : tabs.find((tab) => tab.key === popover.value?.key);
  const resolvePopoverIndex = (): number =>
    popover.value === null
      ? -1
      : tabs.findIndex((tab) => tab.key === popover.value?.key);
  return (
    <header class="tabbar" data-tauri-drag-region>
      <div class="tabbar__tabs" role="tablist" aria-label="Terminal tabs">
        {tabs.map((tab, index) => (
          <div
            key={tab.key}
            role="tab"
            aria-selected={index === active}
            tabIndex={0}
            class={`tab ${index === active ? "is-active" : ""}`}
            onClick={(event) => {
              if (index !== active) {
                props.onSelectTab(index); // inactive tab: just select
                return;
              }
              if (popover.value?.key === tab.key) {
                popover.value = null; // second click on the active tab toggles it off
                return;
              }
              const anchorEl = event.currentTarget as HTMLElement;
              const rect = anchorEl.getBoundingClientRect();
              popover.value = {
                key: tab.key,
                left: rect.left,
                top: rect.bottom + 6,
                anchorEl,
              };
            }}
          >
            <span
              class="tab__dot"
              style={{
                background: tab.dotColor
                  ? tabDotCssColor(tab.dotColor)
                  : dotColor(tab.process),
              }}
            />
            <span class="tab__label">{tab.name ?? tab.process ?? "shell"}</span>
            <button
              type="button"
              class="tab__close"
              aria-label="Close tab"
              onClick={(event) => {
                event.stopPropagation();
                props.onCloseTab(index);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        class="tab-add"
        title="New tab (⌘T)"
        aria-label="New tab"
        onClick={props.onNewTab}
      >
        +
      </button>
      <div class="tabbar__spacer" data-tauri-drag-region />
      <div class="tabbar__actions">
        <button
          type="button"
          class="iconbtn"
          title="Split vertically (⌘D)"
          aria-label="Split pane vertically"
          onClick={props.onSplitRow}
        >
          <SplitRowIcon />
        </button>
        <button
          type="button"
          class="iconbtn"
          title="Split horizontally (⌘⇧D)"
          aria-label="Split pane horizontally"
          onClick={props.onSplitColumn}
        >
          <SplitColumnIcon />
        </button>
        <button
          type="button"
          class="iconbtn"
          title="Close pane (⌘W)"
          aria-label="Close current pane"
          onClick={props.onClosePane}
        >
          <ClosePaneIcon />
        </button>
        <button
          type="button"
          class={`iconbtn ${props.expandActive ? "is-active" : ""}`}
          title="Focus expand (⌘E)"
          aria-label="Toggle focus expand"
          aria-pressed={props.expandActive}
          onClick={props.onToggleExpand}
        >
          <ExpandIcon />
        </button>
        <span class="tabbar__sep" aria-hidden="true" />
        <button
          type="button"
          class={`iconbtn iconbtn--gear ${props.settingsOpen ? "is-active" : ""}`}
          title="Settings"
          aria-label="Open settings"
          aria-pressed={props.settingsOpen}
          onClick={props.onToggleSettings}
        >
          <GearIcon />
        </button>
      </div>
      {popover.value !== null && popoverTab !== undefined && (
        <TabPopover
          left={popover.value.left}
          top={popover.value.top}
          anchorEl={popover.value.anchorEl}
          name={popoverTab.name}
          dotColor={popoverTab.dotColor}
          onRename={(name) => {
            const index = resolvePopoverIndex();
            if (index !== -1) {
              props.onRenameTab(index, name);
            }
          }}
          onPickColor={(color) => {
            const index = resolvePopoverIndex();
            if (index !== -1) {
              props.onSetTabColor(index, color);
            }
          }}
          onClose={() => {
            popover.value = null;
          }}
        />
      )}
    </header>
  );
}
