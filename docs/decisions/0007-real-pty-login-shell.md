---
id: 0007
title: "Real PTY + login shell"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, BUSINESS-FLOW, ARCHITECTURE]
supersedes: []
---

# ADR 0007 — Real PTY + login shell

## Context

Agent CLIs depend on a correct PATH, aliases, and dotfiles. A fake or half terminal breaks these and makes agents misbehave.

## Decision

Every pane is backed by a real PTY spawning `$SHELL -l` (or equivalent login shell). No fake / half terminal surfaces for agent work.

## Consequences

- BUSINESS-FLOW invariant: every pane has exactly one real PTY (login shell or child process tree).
- Architecture keeps the Rust `PtyState` registry as the PTY authority (see ADR 0001).
- `affects` narrowed to `[PRINCIPLES, BUSINESS-FLOW, ARCHITECTURE]`: this is a runtime-fidelity invariant that lives in BUSINESS-FLOW and constrains ARCHITECTURE; it is not a product-scope, UI, or atomic-requirement statement on its own.

## Options rejected

- Emulated / pseudo shell without a real PTY — breaks PATH / aliases / dotfiles, defeating the agent-CLI purpose.
