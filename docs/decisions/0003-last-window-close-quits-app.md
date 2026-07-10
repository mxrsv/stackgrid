---
id: 0003
title: "Last window close quits the app"
date: 2026-07-09
kind: architecture
affects: [BUSINESS-FLOW, ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0003 — Last window close quits the app

## Context

Pre-pipeline ADR `docs/adr/0002-last-tab-close-quits-app.md` made "close last tab" quit the app because Stackgrid had one window. That ADR is pre-pipeline history and is **not** part of the v2 decisions log; this ADR is the active rule that replaces it (there is no in-log `id` to supersede, so `supersedes` stays empty and the replacement is recorded here in prose). v1 product intent is multi-window: closing the last tab of **one** window must close **that window** only; the application exits when the **last window** is gone (or on explicit Quit). Busy confirmation remains on close paths only.

## Decision

- Close last pane in a tab → close tab (unchanged).
- Close last tab in a window → close that window (dispose its remaining PTYs after busy guard).
- Close last window of the app (or Cmd+Q / confirmed quit) → quit the application.
- Swap and move-across-window never prompt for busy.

## Consequences

- Implementers must not treat `tabs.length === 0` as app quit when other windows exist.
- `quit-requested` / `confirm_quit` remain the confirmed exit path for explicit quit and last-window close.
- `affects` deviates from the mechanical default for `kind: architecture`: UX-DESIGN is excluded (this decision has no UI surface), and BUSINESS-FLOW is included (this is a close/quit behavior rule that lives in the flow doc).

## Options rejected

- Keep single-window "last tab quits" semantics — contradicts multi-window v1 intent.
- Quit whenever any window closes — would kill live agents running in other windows.
