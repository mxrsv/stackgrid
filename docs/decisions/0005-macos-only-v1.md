---
id: 0005
title: "macOS only (v1)"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, PRD, ARCHITECTURE]
supersedes: []
---

# ADR 0005 — macOS only (v1)

## Context

Stackgrid is built on Tauri 2 + Preact + xterm.js and uses macOS-specific window / PTY behavior. Committing to cross-platform now would constrain architecture and dilute v1.

## Decision

v1 commits to macOS only. No commitment to Windows or Linux in this cycle.

## Consequences

- Architecture may use macOS-only affordances (window chrome, Gatekeeper, `$SHELL -l`) without a portability abstraction.
- PRD scope and distribution assume macOS.
- `affects` narrowed to `[PRINCIPLES, PRD, ARCHITECTURE]`: platform commitment bounds product scope (PRD) and permits macOS-specific mechanisms (ARCHITECTURE); it does not itself define behavior rules, UI, or atomic requirements.

## Options rejected

- Cross-platform v1 — premature; would add a portability layer with no v1 payoff.
