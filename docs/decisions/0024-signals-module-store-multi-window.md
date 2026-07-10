---
id: 0024
title: "Signals / module-store at multi-window scale"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE]
supersedes: []
---

# ADR 0024 — Signals / module-store at multi-window scale

## Context

Multi-window (ADR 0012) means several OS windows, each its own JS context. State ownership must stay correct without a shared global bus that WKWebView/Tauri cannot reliably provide.

## Decision

Per-webview signals + plugin-store reload via app events.

- Each OS window is its own JS context → module signals (`tabViews`, `statusInfo`, local tab manager) stay local — correct isolation.
- Shared artifacts (`settings.json`, `presets.json`): the writer emits app-wide events (`settings-changed`, `presets-changed`); other windows reload.
- `session.json` is aggregated from all windows on debounce (ADR 0002), not a per-signal global.
- PTY traffic never goes through signals — Rust events → owning webview → `TerminalManager.handleOutput`.

## Consequences

- No cross-webview shared-state layer to keep coherent; each window is authoritative for its own chrome.
- Cross-window consistency for shared files is event-driven reload, not live shared memory.

## Options rejected

- Lift all UI state into Rust — a rewrite that fights the imperative xterm layer.
- SharedWorker / BroadcastChannel between webviews — unreliable under WKWebView/Tauri; still needs Rust for PTY ownership.
