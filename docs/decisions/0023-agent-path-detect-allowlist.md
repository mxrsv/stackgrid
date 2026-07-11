---
id: 0023
title: "Agent PATH detect: allowlist + Rust lookup, immediate spawn"
date: 2026-07-09
kind: architecture
affects: [ARCHITECTURE, REQUIREMENTS]
supersedes: []
---

# ADR 0023 — Agent PATH detect: allowlist + Rust lookup, immediate spawn

## Context

Product ADR 0014 defines the agent picker (PATH-detected agents + Shell + Skip all; pick = spawn). This ADR fixes the detection mechanism.

## Decision

A hardcoded allowlist plus a Rust PATH lookup. The allowlist is aligned with chrome recognition (`claude`, `codex`, `gemini`; extend later without a settings UI). `detect_agents` returns `[{ name, path }]` for allowlisted binaries found on `PATH`. Picker options = detected agents + **Shell only** + **Skip all**. Choosing an agent writes/spawns that command in the pane's shell **immediately**; Shell leaves an idle login shell; Skip all leaves remaining pending panes as shells and keeps already-picked panes. One-shot per materialization. Chrome styling stays foreground process-name match (shipped).

## Consequences

- No settings UI needed for v1; the allowlist is code-defined and cheap to extend.
- Spawn list and chrome recognition share the same allowlist source, satisfying BUSINESS-FLOW invariant "both stay local/PATH".

## Options rejected

- Heuristic scan of all PATH binaries — noisy, slow, un-minimal.
- User-configurable agent list in settings — deferred (PRD Later, ADR 0019).
