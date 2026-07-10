---
id: 0008
title: "Local by default (no telemetry)"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, BUSINESS-FLOW]
supersedes: []
---

# ADR 0008 — Local by default (no telemetry)

## Context

Terminal contents and session data are sensitive. Users expect a local-first tool with no background exfiltration.

## Decision

No telemetry by default. Terminal contents and session / preset data stay on device unless the user explicitly sends them elsewhere.

## Consequences

- BUSINESS-FLOW privacy rules: no telemetry; data stays local.
- No cloud agent catalog; agent discovery stays local / PATH-based.
- `affects` narrowed to `[PRINCIPLES, BUSINESS-FLOW]`: this is a privacy invariant expressed as BUSINESS-FLOW rules; it does not shape product-scope framing, module boundaries, UI, or atomic requirements directly.

## Options rejected

- Opt-out telemetry — contradicts the local-by-default trust posture.
