# Stackgrid 🖥️

A desktop terminal app built with **Tauri 2 + xterm.js + Preact**, made for running AI agent CLIs (`claude`, `codex`, `gemini`...) in a dedicated window.

## Features

- **Real PTY terminal** — spawns a login shell (`$SHELL -l`, so your full PATH is available) via `portable-pty`.
- **Split panes** — split vertically (⌘D) or horizontally (⌘⇧D), close a pane (⌘⇧W), cycle focus (⌘] / ⌘[), drag dividers to resize.
- **Settings** — the gear icon in the sidebar opens a panel to change:
  - Terminal font (installed monospace fonts + custom entry) and font size
  - Color theme presets (Tokyo Night, Dracula, One Dark, Catppuccin Mocha) with per-color overrides for background, foreground, cursor, and selection
  - Sidebar position (left or top)
- **Persistent settings** — stored via `tauri-plugin-store` in `settings.json`; every change applies live.

## Architecture

- **Backend (Rust)** — `src-tauri/src/pty.rs`: manages multiple PTY sessions in a `HashMap` keyed by id. Streams output to the frontend through the `pty:output` event, accepts input via the `write_pty` command, plus `resize_pty` / `kill_pty`.
- **Frontend (TypeScript + Preact)**
  - `src/terminal/` — `terminal-manager.ts` (pane orchestration, shortcuts, PTY events), `pane.ts` (one xterm instance per PTY session), `layout.ts` (imperative DOM for the split tree, kept outside Preact's render loop).
  - `src/lib/split-tree.ts` — immutable binary split tree (pure functions).
  - `src/settings/` — schema/validation, signal-based store persisted with `tauri-plugin-store`, theme presets.
  - `src/ui/` — Preact components: app shell, sidebar, settings panel, controls.
- When a shell exits in the last remaining pane, press **Enter** to start a new session; in other panes the pane closes automatically.

## Development

```bash
npm install
npm run tauri dev
```

## Release build

```bash
npm run tauri build
```

The `.app` / `.dmg` bundles are written to `src-tauri/target/release/bundle/`.

## Using AI agent CLIs

Open the app and type as in any terminal:

```bash
claude          # Claude Code
codex           # OpenAI Codex CLI
gemini          # Gemini CLI
```
