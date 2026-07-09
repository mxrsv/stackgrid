# ADR 0001 — Session restore without CWD

## Status

Accepted (pre-pipeline; still in force under PRINCIPLES).

## Context

Users want tabs and split layouts back after restart, but persisting each pane’s CWD in `session.json` couples restore to fragile filesystem state and conflicts with “fresh shell” expectations.

## Decision

Persist layout chrome only (tab split trees, active tab, name/dot-color overrides). On restore, each pane spawns a fresh login shell at `$HOME`. Per-pane CWDs may still be kept in the **in-memory** closed-tab reopen stack, and in **layout presets** (separate artifact) when the user explicitly saves them.

## Consequences

- `session.json` stays small and stable.
- Layout presets / Open board are the intentional path for “open into known folders.”
- Multi-window restore (v1 product) extends the same chrome-only rule across all windows.
