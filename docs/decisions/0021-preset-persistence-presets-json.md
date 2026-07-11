---
id: 0021
title: "Preset persistence: separate presets.json via plugin-store"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0021 — Preset persistence: separate presets.json via plugin-store

## Context

Product ADR 0015 decided layout presets are a separate artifact from `session.json`. This ADR fixes the storage shape and mechanism.

## Decision

Presets persist in a separate `presets.json` via `@tauri-apps/plugin-store`. Conceptual shape:

```text
PresetsData v1
  version: 1
  presets: [ { id, name, layout: SerializedNode, cwds?: (string | null)[] } ]
```

The CWD array zips leaves left-to-right (same convention as closed-tab snapshots). The built-in default preset (single pane, no CWD) is **code-defined**, always available on the Open board so Open cannot soft-lock. CRUD (save-from-live, rename, delete, overwrite) goes through the store.

## Consequences

- Presets are independent of session restore chrome (ADR 0002); a preset is a reusable template, not per-window state.
- The empty-store case is covered by the code-defined default preset (ADR 0013).

## Options rejected

- Embed presets in `settings.json` — mixes preferences with layout templates.
- One file per preset on disk — unnecessary with plugin-store; weaker atomic overwrite.
