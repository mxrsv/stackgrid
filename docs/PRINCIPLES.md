---
derived: true
derived_from: [0004, 0005, 0006, 0007, 0008, 0009, 0010]
rendered: 2026-07-10
---

# PRINCIPLES

Non-negotiables for Stackgrid. Rendered from the active principle ADRs (`docs/decisions/0004`–`0010`); each bullet traces to one ADR. Keep this list light — it is a view over the ADR log, not a product dump.

- **Agent-CLI terminal first.** Stackgrid exists to run and observe AI agent CLIs well. Features should serve that job; general terminal parity is optional, not the north star. (ADR 0004)
- **macOS only.** v1 commits to macOS; no commitment to Windows/Linux in this document. (ADR 0005)
- **Mouse and keyboard are both first-class.** Everyday use must work well with either; do not design for one input mode at the expense of the other. (ADR 0006)
- **Real PTY + login shell.** Every pane is backed by a real PTY spawning `$SHELL -l` (or equivalent). No fake/half terminal that breaks PATH, aliases, or dotfiles. (ADR 0007)
- **Local by default.** No telemetry. Terminal contents and session data stay on device unless the user explicitly sends them elsewhere. (ADR 0008)
- **MIT / open source.** The project remains openly licensed. (ADR 0009)
- **Session restore = layout chrome, not CWD.** Restoring tabs/layout/names/colors across restarts is in scope; persisting pane CWDs in `session.json` is out. In-session closed-tab reopen may still restore CWDs in memory; layout presets may hold optional per-pane CWDs separately. (ADR 0010)
