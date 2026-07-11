---
id: 0010
title: "Session restore = layout chrome, not CWD"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, PRD, BUSINESS-FLOW, ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0010 — Session restore = layout chrome, not CWD

## Context

Users want tabs and split layouts back after restart, but persisting each pane's CWD in `session.json` couples restore to fragile filesystem state and conflicts with the "fresh login shell" expectation. This principle was first recorded pre-pipeline in `docs/adr/0001-session-restore-without-cwd.md`; this ADR absorbs it into the v2 decisions log as the active principle (the pre-pipeline file remains as history and is not part of the v2 log).

## Decision

Restoring tabs / layout / names / colors across restarts is in scope. Persisting pane CWDs in `session.json` is out of scope. In-session closed-tab reopen may still restore CWDs in memory, and layout presets may store optional per-pane CWDs as a separate artifact.

## Consequences

- PRD journey (Resume) restores chrome only; each pane spawns a fresh shell at `$HOME`.
- BUSINESS-FLOW invariant: `session.json` never persists CWDs or process identity — only layout chrome.
- ARCHITECTURE: the multi-window session schema stays chrome-only (see ADR 0002).
- REQUIREMENTS: restore / CWD-resolution requirements derive from this rule.
- `affects` narrowed to exclude UX-DESIGN: this rule is load-bearing across product intent, flow invariants, architecture, and requirements, but it does not by itself specify a UI surface (the Open board / preset UI that references CWDs is shaped by product / UX ADRs, not this principle).

## Options rejected

- Persist per-pane CWD in `session.json` — fragile against moved / deleted folders and breaks the fresh-shell expectation.
- Persist running processes across restart — out of scope; processes are not serializable session state.
