---
id: 0012
title: "Multi-window workspace model"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0012 — Multi-window workspace model

## Context

v1 product intent is inherently multi-window: users spread agents across several OS windows and expect all of them back after relaunch. The shipped app was single-window.

## Decision

v1 is multi-window. A pane can move to a new window and move or join back into another window/tab (bidirectional); the process keeps running across the move. Layout chrome is persisted and restored for **all** windows. The application exits only when the last window of the app is gone (or on explicit Quit); the concrete close/quit routing is ADR 0003.

## Consequences

- PRD scope and journey (Steer, Resume) assume multiple windows.
- BUSINESS-FLOW gains window states and invariant "app quit ⟺ no windows left".
- ARCHITECTURE must own cross-window PTY routing and multi-window session persistence (ADR 0001, ADR 0002).
- `affects` narrowed to exclude UX-DESIGN: the movement UI is specified by ADR 0016; this ADR sets the product/architecture model and the requirements it generates (cross-window move, restore-all, quit-scope), not the UI.

## Options rejected

- Keep single-window v1 — contradicts the parallel multi-agent job (ADR 0011).
