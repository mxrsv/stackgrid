---
frozen: true
hash: a06e3bee0cac7feb7d51244c8d46960f939f90f54fbd4c793ae2f6abd412f401
from_hash: {}
---
# PRINCIPLES

Non-negotiables for Stackgrid. Keep this list light — root of the docs hash-graph, not a product dump.

- **Agent-CLI terminal first.** Stackgrid exists to run and observe AI agent CLIs well. Features should serve that job; general terminal parity is optional, not the north star.
- **macOS only.** No commitment to Windows/Linux in this document.
- **Mouse and keyboard are both first-class.** Everyday use must work well with either; do not design for one input mode at the expense of the other.
- **Real PTY + login shell.** Every pane is backed by a real PTY spawning `$SHELL -l` (or equivalent). No fake/half terminal that breaks PATH, aliases, or dotfiles.
- **Local by default.** No telemetry. Terminal contents and session data stay on device unless the user explicitly sends them elsewhere.
- **MIT / open source.** The project remains openly licensed.
- **Session restore = layout chrome, not CWD.** Restoring tabs/layout/names/colors across restarts is in scope; persisting pane CWDs in `session.json` is out (see existing ADR). In-session closed-tab reopen may still restore CWDs in memory.
