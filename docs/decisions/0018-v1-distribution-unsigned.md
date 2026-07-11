---
id: 0018
title: "v1 distribution: unsigned (Gatekeeper friction accepted)"
date: 2026-07-09
kind: product
affects: [PRD, BUSINESS-FLOW, REQUIREMENTS]
supersedes: []
---

# ADR 0018 — v1 distribution: unsigned (Gatekeeper friction accepted)

## Context

Signing and notarization add cost and process. For v1, shipping fast matters more than a frictionless first-run install.

## Decision

v1 may ship as an **unsigned** macOS build. The Gatekeeper first-run friction is accepted and documented. Signing / notarization is deferred and is **not** a v1 ship gate.

## Consequences

- PRD scope lists unsigned distribution as acceptable for v1; signed/notarized is "later".
- BUSINESS-FLOW privacy/platform rule: v1 may ship unsigned; Gatekeeper friction is accepted.
- `affects` narrowed to `[PRD, BUSINESS-FLOW, REQUIREMENTS]`: this is a distribution stance; it does not shape UI or architecture modules, but it generates a v1 distribution requirement (unsigned build acceptable).

## Options rejected

- Make signed/notarized a v1 ship gate — delays release for polish that can follow.
