---
id: 0006
title: "Mouse and keyboard both first-class"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, PRD, UX-DESIGN]
supersedes: []
---

# ADR 0006 — Mouse and keyboard both first-class

## Context

Terminal power-tools often bias toward keyboard-only ideology. Stackgrid's users mix mouse-driven rearrangement (drag-dock, swap) with keyboard flows.

## Decision

Everyday use must work well with either mouse or keyboard. Do not design for one input mode at the expense of the other.

## Consequences

- Net-new surfaces (Open board, preset editor, pane movement, sidebar) need both pointer and keyboard affordances (UX-DESIGN).
- Product scope keeps both interaction paths in view.
- `affects` narrowed to `[PRINCIPLES, PRD, UX-DESIGN]`: this is an interaction-parity stance shaping UI design (UX-DESIGN) and product framing (PRD); it does not set flow rules, module structure, or atomic requirements directly.

## Options rejected

- Keyboard-only ideology — excludes mouse-first users and contradicts existing drag-dock UX.
