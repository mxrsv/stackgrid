# Stackgrid — working context

## Pipeline

- `phase: architecture` (`PIPELINE.lock`).
- Frozen: `docs/PRINCIPLES.md`, `docs/PRD.md`, `docs/BUSINESS-FLOW.md`.
- Domain glossary: repo-root `CONTEXT.md`.
- Archives: `docs/CONTEXT-archive.md` (kickoff + product elicitation).
- Pre-pipeline ADRs: `docs/adr/0001-*.md`, `docs/adr/0002-*.md` (0002 needs `/adr` amendment for multi-window quit).
- New ADRs: `docs/decisions/` via `/adr`.

## Product snapshot (frozen — do not re-litigate here)

- Job: observe + control many agent CLIs in parallel on macOS.
- v1 gap vs brownfield: layout presets/mock, pane swap, multi-window move/join, Open board (workspace ∥ preset), post-materialize agent picker, file sidebar preview+diff.
- Session chrome-only (no CWD); presets hold optional per-pane CWDs separately.
- OUT: embed agent UI, SSH, iTerm parity chase, sidebar editing, notarized ship-gate.

## Open for /architecture

- Multi-window session persistence shape (one file vs per-window).
- Agent PATH discovery rules (which names/paths count).
- Open board + preset store + sidebar module boundaries on current Tauri/Preact/xterm stack.
- Whether UX-DESIGN is included or skipped (`decisions.ux`).
- ADR 0002 amendment timing (recommend `/adr` when quit/multi-window design lands).

## Next

- Run `/architecture`.
- If a large decision crystallizes mid-architecture, `/adr`.
