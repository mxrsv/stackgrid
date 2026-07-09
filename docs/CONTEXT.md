# Stackgrid — working context

## Pipeline

- `phase: requirements` (`PIPELINE.lock`).
- Frozen: `docs/PRINCIPLES.md`, `docs/PRD.md`, `docs/BUSINESS-FLOW.md`, `docs/ARCHITECTURE.md`, `docs/UX-DESIGN.md`.
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
- Net-new surface UX (Open board, preset editor, agent picker, file sidebar) → `UX-DESIGN.md`.
- ADRs `docs/decisions/0001–0003` (PTY/window coordinator, multi-window session chrome, last-window-close quits) registered in `adr_manifest`. They are ADR-early (landed before ARCHITECTURE froze) so `pending_arch_sync` stayed false.

## Next

- Run `/requirements` (phase == requirements, `pending_arch_sync == false`).
- If a large decision crystallizes later, `/adr` (an architecture-changing ADR after freeze will set `pending_arch_sync` → `/reconcile ARCHITECTURE`).
