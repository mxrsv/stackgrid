---
id: 0025
title: "v1 stack: Tauri 2 + Preact + xterm.js (hybrid)"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE]
supersedes: []
---

# ADR 0025 — v1 stack: Tauri 2 + Preact + xterm.js (hybrid)

## Context

Stackgrid ships today on a specific stack. This ADR records it as the v1 architectural foundation. The stack is **revisable** — it is not a PRINCIPLES-level non-negotiable (Electron is not forbidden by principle); this ADR pins the v1 choice, and a later ADR may supersede it.

## Decision

v1 stack:

| Layer           | Choice                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| Shell           | Tauri 2 (macOS only), overlay titlebar, unsigned v1 OK                       |
| Backend         | Rust, thin — `portable-pty`, `libc` process introspection, shell-out `git`   |
| UI framework    | Preact 10 (chrome only)                                                      |
| Reactivity      | `@preact/signals` (per-webview module signals)                               |
| Terminal render | xterm.js 6 + Fit / Search / Unicode / WebLinks (imperative DOM)              |
| Persist         | `@tauri-apps/plugin-store` (`settings.json`, `session.json`, `presets.json`) |
| Dialogs         | `@tauri-apps/plugin-dialog` (busy/quit confirms)                             |

Pattern: **hybrid** — Preact owns chrome; `TabManager` / `TerminalManager` / `Pane` own the imperative terminal surfaces and talk to Rust over Tauri IPC. xterm lives in imperative DOM, never inside Preact's tree.

## Consequences

- Aligns with `macOS only` (ADR 0005) and `real PTY + login shell` (ADR 0007).
- The imperative terminal layer is a deliberate boundary; chrome and terminal do not share a render tree.

## Options rejected

- A single heavy React/SPA framework owning the terminal tree — fights the imperative xterm layer.
- A pure-webview terminal without a native PTY — violates real-PTY (ADR 0007).
- Locking the stack as a non-negotiable — rejected; the stack stays revisable (Electron not forbidden).
