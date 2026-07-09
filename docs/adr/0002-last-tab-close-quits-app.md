# ADR 0002 — Last tab close quits the app

## Status

Accepted (pre-pipeline). **Needs `/adr` amendment** for multi-window v1.

## Context

Single-window Stackgrid: closing the last tab left an empty shell or forced an awkward “always keep one tab” rule. Quitting on last-tab close matched user expectation for a focused utility window.

## Decision (original, single-window)

Closing the last tab quits the application. Busy guard still applies before close.

## Pending product amendment (not frozen here)

v1 product intent: closing the last tab of **one** window closes **that window** only; the app quits when the **last window** of the app is closed (or explicit Quit). Record the amendment via `/adr` after PRD/BUSINESS-FLOW freeze — do not silently rewrite this file in `/product`.

## Consequences

- Until amended, implementers must not assume single-window quit semantics forever.
- Busy confirmation remains tied to close, not to swap/move.
