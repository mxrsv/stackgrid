# ADR 0002 — Multi-window session chrome in one file

## Status

Accepted (architecture phase; ADR-early — ARCHITECTURE not yet frozen).

## Context

PRD / BUSINESS-FLOW require restoring layout chrome for **all** windows on relaunch. The shipped `session.json` is a flat single-window `{ version: 1, tabs, activeTab }` with no window dimension. Session must remain chrome-only (no CWD / process) per PRINCIPLES and pre-pipeline ADR 0001.

## Decision

Persist one `session.json` with a version bump to a multi-window shape: a `windows[]` array of per-window tab chrome (layouts, active tab, name/dot-color overrides), plus optional focused-window hint. Cold launch recreates N `WebviewWindow`s from that list, spawns fresh shells at `$HOME`, then runs the one-shot agent picker. Migrate v1 flat sessions to a single-window v2 entry on first load.

## Consequences

- Atomic restore-all from one artifact.
- Debounced save must aggregate chrome across windows.
- Presets stay in a separate `presets.json` (not this file).
