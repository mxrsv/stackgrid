---
id: 0016
title: "Pane swap + cross-window move; busy confirm only on close"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0016 — Pane swap + cross-window move; busy confirm only on close

## Context

Attention shifts between agents. Users need to rearrange panes — exchange two positions, or move a pane to another window — without killing running agents, and without nagging confirmations for non-destructive moves.

## Decision

**Swap** exchanges two panes' positions in the layout; their PTYs/sessions move with them. **Cross-window move** sends a pane to a new window or moves/joins it into another window/tab (bidirectional); the process keeps running. Swap and cross-window move **never** show a busy confirmation. The **busy guard** (confirm when a relevant pane is busy) applies to **close pane / close tab** only. Close routing — last pane → close tab, last tab → close window, last window → quit — is ADR 0003.

## Consequences

- PRD "steer" journey covers swap + move; scope adds pane swap on top of the shipped drag-dock.
- BUSINESS-FLOW invariant: "busy ⇒ confirm only on destructive close, never on swap/move/detach".
- UX-DESIGN specifies swap (center drop zone + shortcut) and the "Move pane to…" affordance.
- `affects` narrowed to exclude ARCHITECTURE: the PTY-ownership mechanism is ADR 0001; the requirements it generates (swap, cross-window move, busy-guard scope) are in scope.

## Options rejected

- Confirm busy on swap/move — nags users during normal rearrangement and discourages the core steer flow.
- Kill and respawn processes on move — loses agent state; the process must survive the move.
