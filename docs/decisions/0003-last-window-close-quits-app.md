# ADR 0003 — Last window close quits the app

## Status

Accepted (architecture phase; ADR-early — ARCHITECTURE not yet frozen).

Supersedes: `docs/adr/0002-last-tab-close-quits-app.md` (single-window quit).

## Context

Pre-pipeline ADR 0002 made “close last tab” quit the app because Stackgrid had one window. v1 product intent is multi-window: closing the last tab of **one** window must close **that window** only; the application exits when the **last window** is gone (or on explicit Quit). Busy confirmation remains on close paths only.

## Decision

- Close last pane in a tab → close tab (unchanged).
- Close last tab in a window → close that window (dispose its remaining PTYs after busy guard).
- Close last window of the app (or Cmd+Q / confirmed quit) → quit the application.
- Swap and move-across-window never prompt for busy.

## Consequences

- Implementers must not treat `tabs.length === 0` as app quit when other windows exist.
- `quit-requested` / `confirm_quit` remain the confirmed exit path for explicit quit and last-window close.
- Pre-pipeline `docs/adr/0002-*.md` is historical; this ADR is the active rule.
