# Stackgrid — working context

## Pipeline

- `phase: done` (`PIPELINE.lock`) — pipeline complete; `requirements_version: 1`.
- Frozen: `docs/PRINCIPLES.md`, `docs/PRD.md`, `docs/BUSINESS-FLOW.md`, `docs/ARCHITECTURE.md`, `docs/UX-DESIGN.md`, `docs/REQUIREMENTS.md`.
- `decisions.ux: included` (UI complex → UX-DESIGN.md produced). `flags.pending_arch_sync: false`.
- Domain glossary: repo-root `CONTEXT.md`.
- Archives: `docs/CONTEXT-archive.md` (kickoff + product elicitation).
- Pre-pipeline ADRs: `docs/adr/0001-*.md`, `docs/adr/0002-*.md` (0002 needs `/adr` amendment for multi-window quit).
- New ADRs: `docs/decisions/` via `/adr`.

## Product snapshot (frozen — do not re-litigate here)

- Job: observe + control many agent CLIs in parallel on macOS.
- v1 gap vs brownfield: layout presets/mock, pane swap, multi-window move/join, Open board (workspace ∥ preset), post-materialize agent picker, file sidebar preview+diff.
- Session chrome-only (no CWD); presets hold optional per-pane CWDs separately.
- OUT: embed agent UI, SSH, iTerm parity chase, sidebar editing, notarized ship-gate.

## Resolved in architecture (frozen — see ARCHITECTURE.md / UX-DESIGN.md)

- Multi-window session persistence, agent PATH discovery, module boundaries → `ARCHITECTURE.md`.
- Net-new surface UX (Open board, preset editor, agent picker, file sidebar, pane movement) → `UX-DESIGN.md`.
- ADRs `docs/decisions/0001–0003` (PTY/window coordinator, multi-window session chrome, last-window-close quits) registered in `adr_manifest`. They are ADR-early (landed before ARCHITECTURE froze) so `pending_arch_sync` stayed false.

## Next

- Pipeline is done. `docs/REQUIREMENTS.md` (frozen, v1 — 41 FR + 9 NFR, full upstream coverage tables, no `stale-deferred`) is the input contract for `superpowers:writing-plans`; planning owns all FR→task decomposition.
- History: the first `/requirements` run (2026-07-10) was blocked by a grill consistency gap — UX-DESIGN wrongly classified **pane swap** and **cross-window move** as shipped (they are net-new per PRD Brownfield note / ARCHITECTURE §2, confirmed absent in `src/`), so neither had an interaction spec; preset CRUD affordances and the preset editor entry point were also unplaced.
- Resolved by `/reconcile UX-DESIGN` (same day, human-confirmed re-freeze, new hash `e5ff0dcf…`): new §6 "Pane movement" (swap = center drop zone on shipped drag-dock + `⌘⌥⇧`+arrows; cross-window move = "Move pane to…" popover, `⌘⇧M` / Window menu), §2 gained the "＋ New preset…" card + card rename/delete, §3 gained entry points, Create-tab CWD resolution (BF-Rule 6/8), and "Save Layout as Preset…" (`⌘⇧S`, save/overwrite). No cascade: REQUIREMENTS did not exist yet.
- If a large decision crystallizes later, `/adr` (an architecture-changing ADR after freeze will set `pending_arch_sync` → `/reconcile ARCHITECTURE`).
