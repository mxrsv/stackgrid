# CONTEXT archive — kickoff

Crystallized kickoff brief (2026-07-09). Living working memory lives in `docs/CONTEXT.md`.

## What it is

Stackgrid is a minimal macOS terminal aimed at people who run AI agent CLIs (Claude Code, Codex, Gemini CLI, and similar). Hierarchy is Window → Tab → Pane. Real PTY, login shell, split panes, themes, session layout restore.

It lives under the Glow workspace as an independent project (own git remote: `mxrsv/stackgrid`). Glow is a parent folder for multiple AI-workflow tools; Stackgrid is not the workspace itself.

## Product stance (confirmed in kickoff)

- Primary job: make running and watching agent CLIs pleasant — not to be a general-purpose iTerm replacement as the north star, even if some iTerm-parity work exists in plans.
- Platform: macOS only for now.
- Input: mouse and keyboard are both first-class; no “keyboard-only ideology.”
- Runtime: real PTY with login shell (`$SHELL -l`) so PATH, aliases, and dotfiles work.
- Stack: currently Tauri 2 + Preact + xterm.js; stack is not locked forever (Electron not forbidden by principle).
- Privacy: no telemetry by default; terminal data stays local unless the user deliberately sends it.
- Scope horizon: may later embed agent UI; not frozen as “terminal-only forever.”
- License: MIT / open source.
- Session restore: keep existing ADR — persist layout chrome (tabs, names, colors), do not persist CWD in `session.json`. CWD only in the in-memory closed-tab stack.

## Existing material (pre-pipeline)

- Root `CONTEXT.md`: domain language glossary (Window, Pane, Tab, Busy, Agent, Session, …). Treat as living vocabulary; distill into PRINCIPLES/PRD as needed, do not duplicate wholesale.
- `docs/adr/0001-session-restore-without-cwd.md`, `docs/adr/0002-last-tab-close-quits-app.md`: decisions already shipped; pipeline `docs/decisions/` is for new ADRs going forward.
- `docs/superpowers/`: prior specs/plans (UI redesign, iTerm parity batch, pane drag, focus expand, public release metadata, etc.). Research backdrop only — not frozen pipeline docs.

## Research notes (light)

- Public positioning matches README: “minimal macOS terminal for AI agent CLIs,” Tauri 2, unsigned Gatekeeper friction on first install.
- Agent recognition today is process-name driven for pane-header styling only.
- Closing the last tab quits the app (ADR 0002); busy guard still applies.
