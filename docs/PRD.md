# PRD — Stackgrid

Product intent, primary journey, and v1 scope. Narrative FR/NFR only — atomic requirements wait for `/requirements`.

## Intent

Stackgrid is a **minimal macOS terminal for people who run AI agent CLIs** (Claude Code, Codex, Gemini CLI, and similar). The pain with iTerm/Terminal.app is not “missing a prettier terminal” — it is the lack of affordances for **observing and controlling many agent CLIs at once**: multiple panes, clear busy/agent state, fast layout control, and light file inspection without leaving the terminal.

**Job to be done:** open a known working folder and layout, spawn agents into panes, watch and steer them in parallel, rearrange or detach panes when attention shifts, and peek at files/diffs the agents touch — without becoming an IDE or a full iTerm replacement.

**Primary user:** a macOS developer who already lives in agent CLIs and keeps several of them running side by side.

**Non-goals (product stance):** Stackgrid does not chase general terminal parity as the north star. Features must serve agent-CLI observation and control first (see PRINCIPLES).

## Journey

### Happy path — start a multi-agent session

1. User opens Stackgrid (or **New Window**).
2. If there is no restorable session (or restore is off / this is a new window), they see the **Open board**: workspace (recent folders + Open Folder, Cursor-style) and **layout preset** side by side.
3. User picks a workspace folder and a preset, then **Open**.
4. Stackgrid materializes a real tab/layout. Each pane’s CWD comes from the preset when set; otherwise the workspace folder (default CWD).
5. Each pane shows an **agent picker** (binaries discovered on `PATH`, plus **Shell only**). Choosing an agent **spawns it immediately**. **Skip all** leaves unpicked panes as idle shells; already-picked panes keep their agent.
6. User watches busy/agent chrome, focuses/splits as needed, and works.

### Resume — open the app again

1. On relaunch with restore enabled, Stackgrid restores **layout chrome for every window** (tabs, splits, names, colors) — not CWDs, not running processes (PRINCIPLES + existing session ADR).
2. After restore, each pane still gets a **one-shot agent picker** (same spawn / Shell / Skip-all rules). Unpicked panes stay idle shells at `$HOME` (session restore behavior).

### Steer — rearrange attention

1. User **swaps** two panes (PTY and contents move with them) when positions are wrong.
2. User **moves a pane to a new window** or **joins it back** into another window/tab (iTerm-style, bidirectional). No busy confirm on swap/move — only close uses the busy guard.
3. Closing the last tab of **one** window closes that window; the app quits only when the last window/tab of the whole app is gone.

### Inspect — file from the CLI

1. User **Cmd+clicks** a filepath in pane output.
2. Relative paths resolve against that pane’s CWD. Missing paths show an error and **do not** open the sidebar.
3. Existing paths open a **right sidebar viewer**: content preview (Markdown rendered for `.md`) and **git diff** when the file is in a git working tree. View only — no editing.

### Capture — save a layout for next time

1. From a live layout, user saves a **named layout preset** (rename / overwrite / delete supported; persisted across restarts).
2. Preset stores split tree + optional per-pane CWDs (separate artifact from `session.json`).
3. Later, user can also build a preset in a **mini layout mock**, confirm, and open it as a **new tab**.

## Scope

### In — v1

- Hierarchy Window → Tab → Pane with real PTY + login shell (existing foundation).
- Focus, split, drag-dock rearrange, busy/agent recognition chrome (existing); plus **pane swap** (exchange two panes’ positions with PTYs).
- **Multi-window**: move pane to new window and move/join back; persist and restore chrome for **all** windows; quit rule scoped to last window of the app.
- **Open board**: workspace recents + Open Folder + layout preset, parallel fields; always on New Window / no session / restore off.
- **Layout presets**: mini mock editor → new tab; save from live layout; CRUD named presets; split + optional CWD-per-pane; default CWD when unset.
- **Post-layout / post-restore agent picker**: PATH auto-detect + Shell + Skip all; pick = spawn immediately.
- **File sidebar**: Cmd+click path → Markdown/content preview + git diff; viewer only; resolve/missing rules above.
- Session restore remains **layout chrome only** (no CWD in session file); closed-tab in-memory CWD stack remains as today.
- Distribution: **unsigned** macOS build acceptable for v1 (Gatekeeper friction documented); signed/notarized later.
- Mouse and keyboard both first-class for the above flows.

### Out — v1

- Embedded agent UI / IDE-like agent panels.
- Remote / SSH hosts and profiles.
- Full iTerm parity (triggers, complex profiles, etc.) as a goal.
- Editing files inside the sidebar.
- Signed/notarized release as a v1 ship gate.
- Persisting CWDs or running processes inside `session.json`.

### Later (explicitly deferred)

- Richer agent discovery / user-configured agent list (v1 is PATH detect only).
- Signed/notarized distribution.
- Any embed-agent or deeper IDE adjacency.

### Brownfield note

Shipped today: focus, split, drag-dock, expand/zoom, session chrome restore, closed-tab + CWD in memory, agent/busy styling. **Not shipped:** layout presets/mock, pane swap, multi-window, Open board, sidebar preview/diff, post-restore agent picker. v1 scope is the gap between that foundation and the journey above.
