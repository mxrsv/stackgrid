---
id: 0011
title: "Product intent: parallel multi-agent observe & control"
date: 2026-07-09
kind: product
affects: [PRD]
supersedes: []
---

# ADR 0011 — Product intent: parallel multi-agent observe & control

## Context

iTerm / Terminal.app are fine general terminals but lack affordances for observing and controlling many agent CLIs at once: multiple panes, clear busy/agent state, fast layout control, and light file inspection without leaving the terminal.

## Decision

Stackgrid's job-to-be-done: open a known working folder and layout, spawn agents into panes, watch and steer them in parallel, rearrange or detach panes when attention shifts, and peek at files/diffs the agents touch — without becoming an IDE or a full iTerm replacement. Primary user: a macOS developer who already lives in agent CLIs and keeps several running side by side. Product non-goal: chasing general terminal parity as the north star.

## Consequences

- PRD intent, primary journey, and scope are framed around parallel agent-CLI observation/control.
- `affects` narrowed to `[PRD]`: this is a product-intent framing; concrete flow rules, architecture, UI, and atomic requirements come from the feature ADRs downstream (0012–0019) and the requirements phase.

## Options rejected

- Position Stackgrid as a general iTerm replacement — dilutes the agent-CLI focus that justifies the product.
