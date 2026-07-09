# ADR 0001 — Rust PTY / window coordinator

## Status

Accepted (architecture phase; ADR-early — ARCHITECTURE not yet frozen).

## Context

v1 requires multiple OS windows with panes that move between windows while keeping processes alive. Today each webview listens to all `pty:output` / `pty:exit` events and assumes a single window. Without a single ownership authority, move-across-window races and orphaned PTYs are likely.

## Decision

Keep the Rust `PtyState` registry keyed by pane-id (PTY id). Add an app-level Rust coordinator that maps `pane-id → window` and routes PTY output/exit events to the owning webview only. Move-across-window reassigns ownership and notifies both windows to detach/attach xterm; it does not kill the PTY.

## Consequences

- New IPC for ownership changes and targeted event delivery.
- Frontend per-window managers stay responsible for layout trees and xterm attachment only.
- Closing a window disposes only PTYs still owned by that window (subject to busy close guards).
