# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Stackgrid — a minimal macOS terminal (Tauri 2) for running many AI agent CLIs (Claude Code, Codex, Gemini CLI) side by side. Frontend: Preact + `@preact/signals` + xterm.js 6 + TypeScript + Vite. Backend: thin Rust (`portable-pty`, shell-out `git`). macOS only.

## Commands

- `npm run tauri dev` — run the desktop app in development
- `npm run tauri build` — release build → `src-tauri/target/release/bundle/`
- `npm test` — all tests (`vitest run`)
- `npx vitest run src/lib/split-tree.test.ts` — single test file
- `npx tsc --noEmit` — typecheck (CI runs typecheck + tests; there is no lint step)

Landing page (separate Vite root at `marketing/`, deployed to Vercel from `marketing/dist`):

- `npm run landing:dev` / `npm run landing:build` / `npm run landing:preview`
- Asset conventions (what goes in `marketing/public/` vs stays out) are in `marketing/README.md`.

### Versioning & release conventions

- Any build containing new changes must bump the version in **all three** places together: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`.
- Every release/version bump must also update `README.md` (features, shortcuts, stale info).
- Release is tag-driven: pushing a `v*` tag runs `.github/workflows/release.yml` (tauri-action, universal macOS build).

## Domain language

`CONTEXT.md` at the repo root defines the ubiquitous language (Window → Tab → Pane, Workspace, Materialize, Busy, Agent launch, …). Use these terms exactly — each entry lists "Avoid" synonyms not to use in code, docs, or commits. Key invariants:

- **Window → Tab → Pane.** A Workspace (folder) is 1:1 with a Tab and is the tab's identity for its whole life; `cd` inside a pane never changes it.
- **Pane-id ≡ PTY id.** `spawn_shell` returns the id used as both the split-tree leaf id and the xterm routing key. Serialized layouts/presets strip ids; materialize spawns fresh shells and assigns ids left-to-right (`treeFromLayout`).
- **No session restore** (removed in 0.4.0). The app always opens on the Open board. Only settings, layout presets, workspace recents, and logos persist — `settings.json`, `presets.json`, `workspaces.json`, `logo.json` via tauri-plugin-store.
- **Agent launch is typing, not spawning.** The chosen agent is typed (`<agent>\r`) into each new pane's interactive shell once it is ready (`src/terminal/agent-launch.ts`) — never spawned from Rust, so the login shell's real `$PATH` applies.

## Architecture

Hybrid pattern — two frontend layers with a hard boundary:

- **Preact owns the chrome only** (tab bar, status bar, settings, Open board, preset editor, dialogs): `src/ui/`, `src/open-board/`, `src/presets/`, `src/settings/`. State lives in per-webview module signals.
- **The terminal layer is imperative**: `src/terminal/` (`TabManager`, `TerminalManager`, `Pane`, `layout-engine`, keymap). xterm.js instances are never rendered inside the Preact tree — they attach to the DOM directly and talk to Rust over Tauri IPC.
- **`src/lib/` is pure**: split-tree, process-info, geometry, schemas… no Preact/DOM/Tauri imports. Dependency direction is one-way: components → lib, never lib → components.

Rust backend (`src-tauri/src/`): `pty.rs` holds the `PtyState` registry (live PTYs keyed by pane-id, each running the user's login shell `$SHELL -l`); `info.rs` polls `pty_info` (cwd + foreground process → busy state and agent-colored chrome); plus `agents.rs`, `links.rs`, `coordinator.rs`, `menu.rs`. PTY data flows Rust events (`pty:output` / `pty:exit`) → `TerminalManager.handleOutput` — never through signals.

A pane is **busy** when its foreground process is not an idle shell; agent recognition (`claude` / `codex` / `gemini` by process name) drives the per-agent colors. Busy guards run only on close/quit paths.

`docs/ARCHITECTURE.md` is the deep-dive reference: full IPC catalog, state-ownership table, split-tree contract, and per-decision rationale pointers.

## Docs

- `docs/decisions/` — append-only ADRs; never edit an existing one (a change of mind = a new superseding ADR).
- `docs/PRINCIPLES.md`, `PRD.md`, `BUSINESS-FLOW.md`, `ARCHITECTURE.md`, `UX-DESIGN.md`, `REQUIREMENTS.md` — derived from the ADR set.
- `docs/plans/` and `docs/specs/` — dated implementation plans and specs.

## Tests

Vitest, colocated `*.test.ts(x)` next to source. The default environment is node; DOM tests opt in per file with a leading `// @vitest-environment jsdom` comment.
