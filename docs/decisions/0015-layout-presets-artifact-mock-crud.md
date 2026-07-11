---
id: 0015
title: "Layout presets: separate artifact, mock editor, CRUD"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0015 — Layout presets: separate artifact, mock editor, CRUD

## Context

Users want to reopen known layouts (and optionally known folders) quickly. Session chrome is layout-only and per-window; presets are a reusable template that may also carry CWDs — a different concern from `session.json`.

## Decision

Layout presets are a **separate persisted artifact** from `session.json`. A preset stores a split tree + optional per-pane CWDs (v1 minimum: tree + CWD map; may carry tab chrome later). CRUD: the user can save the current live layout as a named preset and rename / delete / overwrite presets; presets persist across restarts. A mini layout **mock** editor lets the user design a layout model, confirm, and **open it as a new tab** (it does not apply over the current tab in place). Saving from a live layout does not require the mock.

## Consequences

- PRD "capture" journey and scope cover preset CRUD + mock editor.
- BUSINESS-FLOW gains preset-store states and preset rules; the built-in default preset (ADR 0013) covers the empty-store case.
- UX-DESIGN specifies the mock editor, the "Save Layout as Preset…" affordance, and per-card rename/delete.
- `affects` narrowed to exclude ARCHITECTURE: the `presets.json` persistence is an architecture consequence recorded in ADR 0021; the requirements it generates (preset CRUD, mock → new tab, default preset) are in scope.

## Options rejected

- Store presets inside `session.json` — conflates a reusable template with per-window restore chrome (ADR 0002).
- Mock editor applies over the current tab in place — surprising; opening a new tab is safer and matches intent.
