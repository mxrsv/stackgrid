<p align="center">
  <img src=".github/assets/icon.svg" width="128" alt="Stackgrid icon" />
</p>

<h1 align="center">Stackgrid</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/mxrsv/stackgrid/releases/latest"><img src="https://img.shields.io/github/v/release/mxrsv/stackgrid" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/platform-macOS%2010.15%2B-lightgrey" alt="Platform: macOS 10.15+">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202-24C8DB" alt="Built with Tauri 2">
</p>

<p align="center">
  <em>A minimal macOS terminal for running many AI agent CLIs side by side.</em>
</p>

![Stackgrid — split panes running agent CLIs](.github/assets/screenshot.png)

## Why Stackgrid?

Stackgrid is a minimal macOS terminal built for people who run **AI agent CLIs** — Claude Code, Codex, Gemini CLI, and the like. The problem with iTerm and Terminal.app isn't that they need to be prettier; it's that they have no affordances for **watching and steering many agents at once**.

Stackgrid's whole job: open a working folder and a layout, launch an agent into every pane, read each pane's busy/idle state at a glance, rearrange panes as your attention shifts, and jump from a file path in the output straight to your editor — without turning into an IDE.

If you already live in agent CLIs and keep several running in parallel, it's built for you.

## Features

### 🖥️ Real PTY, real shell

Every pane is backed by a real PTY running your **login shell** (`$SHELL -l`) via Rust's `portable-pty` — so your `PATH`, aliases, and dotfiles just work, and agent binaries are actually found. Full truecolor (`COLORTERM=truecolor`), UTF-8-safe across read boundaries (box-drawing and CJK/Vietnamese render cleanly), and closing a pane kills the **whole process tree** so agents and their child editors never leak.

### 🔲 Split panes & layouts

- Split any pane **vertically** (⌘D) or **horizontally** (⌘⇧D) into a nested layout tree.
- **Drag the dividers** to resize; each split remembers its ratio.
- **Focus** by cycling (⌘] / ⌘[) or by direction (⌘⌥ + arrow keys).
- **Zoom** a single pane to fill the tab (⌘⇧Enter, tmux-style), or **Focus Expand** (⌘E) to gently enlarge whichever pane is active.
- **Drag-dock** a pane by its header onto any edge of another pane to re-split on the fly.

### 🗂️ Workspaces & the Open board

- A **workspace** is a folder you pick as the working root — and it maps 1:1 to a tab. Reopening a workspace focuses its existing tab instead of creating a duplicate.
- The **Open board** is the app's single entry point (also shown on New Tab, ⌘T): a three-column screen — the workspace sidebar, a logo panel, and a stack of **recent workspaces → layout preset → agent**.
- Each recent row **remembers your last layout + agent combo** and preselects them, so reopening a project is a keystroke away.
- Switch between a vertical **workspace sidebar** and a horizontal **tab bar** in Settings.
- **Workspace logos** — each workspace auto-detects a favicon from the repo as its icon, or drag-drop your own image onto it.

### 🤖 Launch agents into every pane

- Pick an agent once on the Open board and Stackgrid launches it in **every pane** of the new tab — four panes, four agents running in parallel.
- Agents are auto-discovered through the **same interactive login shell your panes run** (Claude Code, Codex, Gemini CLI) — so anything runnable in a pane, including CLIs put on `PATH` by `.zshrc`/`.bashrc`, shows up in the picker; pick **Shell only** to skip.
- Running agents get **chrome**: the pane header, status bar, and busy dot are colored by process — Claude magenta, Codex green, Gemini cyan — so you can read the state of every pane in one glance.

### 💾 Layout presets

Save a split layout (plus optional per-pane working directories) as a **named preset** — from a live layout (⌘⇧S) or by sketching one in a mini editor. Rename, overwrite, and delete; presets persist across restarts.

### 🎨 Themes

Four built-in presets — **Tokyo Night** (default), **Dracula**, **One Dark**, and **Catppuccin Mocha** — each a full 16-color ANSI palette. Override any color (background, foreground, cursor, selection) yourself. The theme drives the app's own chrome too, not just the terminal.

### 🔗 Cmd+click a path or URL

Hold ⌘ and click in any pane's output:

- a **file path** (with optional `:line:col`) opens in your editor — VS Code, Cursor, Zed, or a custom command — resolving relative paths against that pane's working directory;
- a **URL** opens in your default browser.

Plain clicks still belong to the terminal, so mouse-driven TUIs (Claude Code, Codex) keep working.

### 🔍 Search & scrollback

Incremental, case-insensitive **find** in the focused pane (⌘F) with match counts, and **clear buffer** (⌘K) to drop scrollback while keeping the current prompt.

### 🪶 Lightweight & local-first

A native **Tauri 2** shell — no Electron. Everything stays on your machine: **no telemetry, no accounts, no network** beyond what your own agents do.

## How it works

Stackgrid's model is **Window → Tab → Pane**:

- **Pane** — one visible terminal, backed by exactly one PTY.
- **Tab** — a split-layout tree of panes, bound to one **workspace** folder for its whole life.
- **Window** — owns its tabs.

A pane is **busy** when its foreground process is something other than an idle shell (e.g. `claude`, `vim`) — that's what the busy dots track, and what the quit/close guards check before prompting. Stackgrid doesn't restore sessions across launches: it always opens on the Open board, and you reopen folders from Recents. Only your settings, layout presets, workspace recents, and logos persist.

## Install

1. Download the latest `.dmg` from [Releases](https://github.com/mxrsv/stackgrid/releases/latest).
2. Drag **Stackgrid** into **Applications**.
3. First launch — the app is not signed with an Apple Developer ID yet, so macOS Gatekeeper will block it ("Apple could not verify…"). Click **Done** (not "Move to Trash"), then either:
   - Run `xattr -cr /Applications/Stackgrid.app` once, or
   - Open **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.
   - On macOS 14 and earlier you can also right-click **Stackgrid.app** → **Open** → **Open**.

## Keyboard shortcuts

**Panes**

| Shortcut  | Action                     |
| --------- | -------------------------- |
| ⌘D        | Split pane vertically      |
| ⌘⇧D       | Split pane horizontally    |
| ⌘] / ⌘[   | Focus next / previous pane |
| ⌘⌥ + ←→↑↓ | Focus pane by direction    |
| ⌘⇧⏎       | Zoom / restore active pane |
| ⌘E        | Toggle Focus Expand        |
| ⌘W        | Close pane                 |

**Tabs**

| Shortcut  | Action                |
| --------- | --------------------- |
| ⌘T        | New tab (Open board)  |
| ⌘⇧W       | Close tab             |
| ⌘⇧T       | Reopen closed tab     |
| ⌘⇧] / ⌘⇧[ | Next / previous tab   |
| ⌘1 … ⌘9   | Select tab _N_        |
| ⌘⇧S       | Save layout as preset |

**Terminal & view**

| Shortcut     | Action                     |
| ------------ | -------------------------- |
| ⌘F           | Find in scrollback         |
| ⌘K           | Clear buffer               |
| ⌘+ / ⌘- / ⌘0 | Font zoom in / out / reset |
| ⌘Q           | Quit                       |

## Settings

Open **Settings** from the toolbar to configure:

- **Font** family and size (default SF Mono, 13px), plus live font zoom (⌘+ / ⌘- / ⌘0).
- **Theme** and per-color overrides.
- **Editor** for ⌘+click — VS Code, Cursor, Zed, or a custom command.
- **Tab bar position** — left sidebar or top bar.
- **Focus Expand** and **pane bar** toggles.

Settings, layout presets, workspace recents, and logos are stored as JSON via the Tauri store; the panel has a **Restore defaults** button.

## Build from source

Requires Node.js 20+, Rust (stable) and the Tauri 2 prerequisites for macOS.

```bash
npm install
npm run tauri dev     # development
npm run tauri build   # release build → src-tauri/target/release/bundle/
```

## Tech stack

- **[Tauri 2](https://tauri.app)** — native macOS shell (Rust), real PTYs via `portable-pty`.
- **[xterm.js 6](https://xtermjs.org)** — terminal rendering, with the fit / search / unicode-graphemes addons.
- **[Preact](https://preactjs.com)** + `@preact/signals` — UI.
- **TypeScript**, **[Vite 6](https://vite.dev)**, **Vitest**.

## License

[MIT](LICENSE) © 2026 mxrsv
