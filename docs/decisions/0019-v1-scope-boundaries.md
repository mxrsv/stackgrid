---
id: 0019
title: "v1 scope boundaries (out + deferred)"
date: 2026-07-09
kind: product
affects: [PRD]
supersedes: []
---

# ADR 0019 — v1 scope boundaries (out + deferred)

## Context

A minimal product needs explicit boundaries so feature pressure does not creep the v1 surface. The intent (ADR 0011) and feature ADRs define what is in; this ADR pins what is deliberately out or deferred.

## Decision

**Out of v1:**

- Embedded agent UI / IDE-like agent panels.
- Remote / SSH hosts and profiles.
- Full iTerm parity (triggers, complex profiles, etc.) as a goal.
- Editing files inside the sidebar.
- Signed / notarized release as a v1 ship gate.
- Persisting CWDs or running processes inside `session.json`.

**Later (explicitly deferred):**

- Richer agent discovery / user-configured agent list (v1 is PATH detect only).
- Signed / notarized distribution.
- Any embed-agent or deeper IDE adjacency.

## Consequences

- PRD "Out" and "Later" sections render from this ADR.
- `affects` narrowed to `[PRD]`: scope boundaries are a product-scope statement; individual "out" items are also echoed as Options rejected in the feature ADRs they bound.

## Options rejected

- Leave scope implicit — invites scope creep and blurs the v1 ship line.
