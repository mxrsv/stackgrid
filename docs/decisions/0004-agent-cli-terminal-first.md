---
id: 0004
title: "Agent-CLI terminal first"
date: 2026-07-09
kind: principle
affects: [PRINCIPLES, PRD]
supersedes: []
---

# ADR 0004 — Agent-CLI terminal first

## Context

Stackgrid competes with iTerm / Terminal.app not on being a prettier general terminal, but on affordances for running and observing many AI agent CLIs at once. Without a stated north star, feature pressure drifts toward general terminal parity.

## Decision

Stackgrid exists to run and observe AI agent CLIs (Claude Code, Codex, Gemini CLI, and similar) well. Features must serve that job first. General terminal parity is optional, not the north star.

## Consequences

- Product scope (PRD) prioritizes agent-CLI observation / control; parity work is opportunistic, never a v1 goal.
- Trade-offs that help agent-CLI workflows at the cost of exotic terminal features are acceptable.
- `affects` narrowed to `[PRINCIPLES, PRD]`: this is a product-intent stance framing PRD scope; it does not by itself set flow rules, module boundaries, UI specs, or atomic requirements (those come from downstream product/architecture ADRs).

## Options rejected

- Aim for full iTerm parity as the product goal — dilutes focus and is explicitly out of v1 scope.
