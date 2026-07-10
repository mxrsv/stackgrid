---
id: 0020
title: "Pane-id ≡ PTY id"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0020 — Pane-id ≡ PTY id

## Context

Multi-window routing and pane swap need a stable identity that ties a layout leaf to its live PTY and to the xterm instance showing it. The shipped app already returns a numeric PTY id from `spawn_shell`.

## Decision

Pane-id ≡ PTY id. `spawn_shell` returns a `u32`; that value is the leaf id in the split tree and the xterm routing key. Session / preset serialization **drops** ids (structure + ratios only); restore / Open assign fresh ids left-to-right via `treeFromLayout`. Swap exchanges two leaf ids in the tree (pure tree transform, no PTY churn). Last-pane exit respawn keeps today's `replaceLeaf(oldId, newId)` behavior.

## Consequences

- One key threads PTY registry, split-tree leaves, and xterm attachment — no second identity to reconcile.
- Serialized layouts stay id-free, consistent with fresh-shell restore (ADR 0010).

## Options rejected

- Logical UUID pane-id separate from PTY id — double-keys every IPC; v1 needs no identity across respawn/restart.
- Persist pane-ids in session chrome — meaningless under fresh-shell restore; conflicts with ADR 0010.
