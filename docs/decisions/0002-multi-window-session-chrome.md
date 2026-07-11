---
id: 0002
title: "Multi-window session chrome in one file"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0002 — Multi-window session chrome in one file

## Context

PRD / BUSINESS-FLOW require restoring layout chrome for **all** windows on relaunch. The shipped `session.json` is a flat single-window `{ version: 1, tabs, activeTab }` with no window dimension. Session must remain chrome-only (no CWD / process) per PRINCIPLES and pre-pipeline ADR `docs/adr/0001-session-restore-without-cwd.md`.

## Decision

Persist one `session.json` with a version bump to a multi-window shape: a `windows[]` array of per-window tab chrome (layouts, active tab, name/dot-color overrides), plus optional focused-window hint. Cold launch recreates N `WebviewWindow`s from that list, spawns fresh shells at `$HOME`, then runs the one-shot agent picker. Migrate v1 flat sessions to a single-window v2 entry on first load.

## Consequences

- Atomic restore-all from one artifact.
- Debounced save must aggregate chrome across windows.
- Presets stay in a separate `presets.json` (not this file).

## Options rejected

- One session file per window — loses atomic restore-all and complicates cross-window aggregation.
- Add CWD / process identity to `session.json` — violates PRINCIPLES (session = layout chrome only).
