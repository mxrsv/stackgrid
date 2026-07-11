---
id: 0013
title: "Open board (workspace ∥ preset) + CWD origin"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0013 — Open board (workspace ∥ preset) + CWD origin

## Context

Starting a session needs an explicit choice of where to work and which layout to materialize. Without a gate, a new/empty window would show nothing useful, and pane CWDs would be undefined.

## Decision

On New Window, missing/disabled session restore, or an empty session, Stackgrid shows the **Open board**: workspace (recent folders + Open Folder, Cursor-style) and layout preset as two parallel fields. Open requires a workspace folder and a layout preset; if the user has no saved presets a built-in default single-pane preset is always available so Open cannot soft-lock. Confirming Open materializes one tab/layout in that window.

CWD origin at materialize: a pane's CWD = its preset pane CWD when set, else the workspace folder. At runtime, a new split or new tab inherits the focused pane's CWD (existing behavior). Session-restore spawn CWD is `$HOME` (ADR 0010), not this path. "Workspace" means a local folder — distinct from Window and from Session.

## Consequences

- PRD "start a session" and "resume" journeys route through the Open board (restore path still runs the agent picker, ADR 0014).
- BUSINESS-FLOW gains Open-board states/rules and the CWD-resolution cluster; invariant "workspace ≠ window ≠ session".
- UX-DESIGN specifies the two-field board and the "＋ New preset…" affordance.
- `affects` narrowed to exclude ARCHITECTURE: the board is product/UX behavior and storage mechanisms are downstream; the requirements it generates (Open-board gate, workspace ∥ preset, CWD resolution, default preset) are in scope.

## Options rejected

- Auto-open a default layout with no board — leaves workspace/CWD implicit and undermines "open a known folder + layout".
- Treat "workspace" as a synonym for window or session — breaks the domain language.
