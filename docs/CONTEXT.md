# Stackgrid — working context

## Pipeline (adk v2, ADR-first)

- `phase: done` (`PIPELINE.lock`, `lock_version: 2`, `project_type: brownfield`).
- Source of truth = the active ADR set in `docs/decisions/`. The big docs are **rendered
  views** derived from it, not authoritative on their own. Each carries `derived: true` +
  `derived_from: [ids]`; only `REQUIREMENTS.md` also carries `version:`.
- Rendered docs: `docs/PRINCIPLES.md`, `docs/PRD.md`, `docs/BUSINESS-FLOW.md`,
  `docs/ARCHITECTURE.md`, `docs/UX-DESIGN.md`, `docs/REQUIREMENTS.md`.
- Active set = every ADR whose `id` is not listed in another ADR's `supersedes`.
  Currently `0001–0026` are all active (no supersede chains inside the pipeline set).
- Domain glossary: repo-root `CONTEXT.md`.
- Archives: `docs/CONTEXT-archive.md` (kickoff + product elicitation).
- Pre-pipeline ADRs `docs/adr/0001-*.md`, `docs/adr/0002-*.md`: kept as historical
  archive. Their content was carried forward — `docs/adr/0001` (session chrome, not CWD)
  into ADR 0010; `docs/adr/0002` (multi-window quit) into ADR 0003. Do not edit the
  archived pair; amend via a new `docs/decisions/` ADR instead.

## Migration note (v1 → v2)

- This tree was re-bootstrapped from an adk **v1** pipeline (freeze-gated: frontmatter
  `frozen/hash/from_hash`, `lock_version: 1`). Method: KIỂU B brownfield re-bootstrap,
  done manually (no `adk migrate` skill; v2 skills refuse `lock_version: 1`).
- The v1 frozen docs were reverse-engineered into ADRs `0004–0026` (7 principle,
  9 product, 7 architecture). The 3 pre-existing ADRs `0001–0003` were normalized to v2
  frontmatter and kept (0003 still records that it replaces pre-pipeline `docs/adr/0002`).
- **Hook skipped by design:** no `on-render` / freeze hook was wired for v2 (user choice).
  Renders were gated manually — each doc diffed and human-confirmed before replacing the
  target. If automation is added later, note it here.
- REQUIREMENTS preserved v1 ID continuity: all **45 FR + 9 NFR** IDs carried over 1:1,
  no renumbering, `version: 1` kept.

## Product snapshot (see PRD.md / BUSINESS-FLOW.md)

- Job: observe + control many agent CLIs in parallel on macOS.
- Net-new vs the shipped brownfield: layout presets/mock, pane swap, multi-window
  move/join, Open board (workspace ∥ preset), post-materialize agent picker, file
  sidebar preview+diff.
- Session persists chrome only (no CWD); presets hold optional per-pane CWDs separately.
- OUT: embed agent UI, SSH, iTerm parity chase, sidebar editing, notarized ship-gate.

## Code state (`60ebe99`)

- The v1 stack is live (Tauri 2 + Rust + Preact + xterm.js — ADR 0025). At this HEAD the
  Rust/coordinator seams are **actively landing**: PTY/window coordinator, tab
  materialize, layout engine, and the close-coordinator paths were deepened in the last
  refactor. Treat `src-tauri` module boundaries as in-flight when planning.

## Adding a decision

- Append a new immutable ADR to `docs/decisions/NNNN-slug.md` (frontmatter
  `id/title/date/kind/affects/supersedes`; body `## Context / ## Decision /
  ## Consequences / ## Options rejected`). To reverse an earlier call, write a new ADR
  that lists the old `id` in `supersedes` — never edit a landed ADR.
- Then re-render every doc in the new ADR's `affects`, diff, and human-confirm before
  replacing. A doc `D` may only derive from ADR `A` when `D ∈ A.affects`.

## Next

- Pipeline is done. `docs/REQUIREMENTS.md` (45 FR + 9 NFR, full upstream coverage tables)
  is the input contract for `superpowers:writing-plans`; planning owns all FR→task
  decomposition.
