---
id: 0026
title: "Flat visual identity (no native macOS skins)"
date: 2026-07-09
kind: architecture
affects: [UX-DESIGN]
supersedes: []
---

# ADR 0026 — Flat visual identity (no native macOS skins)

## Context

Stackgrid ships a flat visual identity (Tokyo Night tokens, borderless edge-to-edge panes, 1px hairline dividers, no drop shadows). A prototype review explored native macOS "skins" (vibrancy / Xcode / unified toolbar) as an alternative direction for the net-new surfaces.

## Decision

Keep the flat, single-system visual identity; reject native macOS skins. Depth comes from background steps and 1px hairlines, never drop shadows. Tokens are those already in the shipped `styles.css`: `--bg` / `--fg` / `--accent` (Tokyo Night blue, not macOS system blue), chrome steps `--chrome-1/2`, hairlines `--hair` / `--hair-strong`, text `--text-primary/muted/faint`; UI font SF Pro, mono SF Mono. Panes are borderless and edge-to-edge with a 1px divider line; the active pane is a 1px inset accent frame (no radius, no gap). Overlays and side panels keep a 12–14px radius and rise/fade with restrained motion.

## Consequences

- UX-DESIGN §1 (design language) and every net-new surface adopt this identity; new chrome must not introduce native-skin material or per-pane corner radius.
- `affects` narrowed to `[UX-DESIGN]`: this is a UI design-system decision that shapes the look of the UX surfaces only; it does not change module boundaries (ARCHITECTURE) or generate testable requirements (REQUIREMENTS).

## Options rejected

- Native macOS skins (vibrancy / Xcode / unified toolbar) — prototyped and rejected to keep the shipped flat identity.
- Rounded, gapped panes (earlier idiom) — replaced by borderless, 1px-divider panes.
