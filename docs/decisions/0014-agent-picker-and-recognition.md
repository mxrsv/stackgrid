---
id: 0014
title: "Agent picker (PATH + Shell + Skip-all) + agent-state recognition"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0014 — Agent picker (PATH + Shell + Skip-all) + agent-state recognition

## Context

After a layout materializes (Open or restore), each pane needs a fast, no-config way to launch an agent CLI or stay a plain shell. Separately, panes must show whether a foreground process is idle, busy, or a recognized agent.

## Decision

After materialize or session restore, each pane shows a **one-shot** agent picker. Options = agent CLIs detected on `PATH` + "Shell only"; no mandatory user configuration in v1. Choosing an agent spawns that command immediately; choosing Shell leaves an idle login shell; **Skip all** sends every still-pending pane to Shell while already-chosen panes keep their spawn. The picker is one-shot per materialization — dismissed/skipped panes do not re-prompt until a new Open/restore cycle.

Agent-state recognition for chrome: a pane is **Busy** when its foreground process is not an idle shell, and **Agent-styled** (header/badge) when the foreground process name matches a recognized agent. Both the spawn list and recognition stay local / PATH- and process-name-based — no cloud agent catalog.

## Consequences

- PRD journeys (start + resume) always run the picker; restore never skips it (invariant).
- BUSINESS-FLOW gains agent-pick-pending state, pane Busy/Agent-styled/Picker states, and invariant "agent recognition and spawn list both stay local/PATH".
- UX-DESIGN specifies the picker overlay.
- `affects` narrowed to exclude ARCHITECTURE: PATH-discovery and process-name mechanisms are architecture detail; the requirements it generates (picker options, immediate spawn, Skip-all, one-shot, local recognition) are in scope.

## Options rejected

- Mandatory user-configured agent list in v1 — adds setup friction; PATH auto-detect is enough.
- Re-prompt the picker on every focus — the one-shot-per-materialization rule keeps it unobtrusive.
- Cloud/remote agent catalog — violates local-by-default (ADR 0008).
