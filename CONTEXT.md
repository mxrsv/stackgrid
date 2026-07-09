# Stackgrid

A minimal macOS terminal for AI agent CLIs. The UI hierarchy is Window → Tab → Pane.

## Language

**Window**:
A single Stackgrid application instance — one macOS window owning its own tabs and panes. Each window has an independent session if multi-window is supported.
_Avoid_: Tab, app, workspace

**Pane**:
A single visible terminal region backed by exactly one PTY. Every tab has at least one pane; splitting adds more panes — it does not change what a pane is.
_Avoid_: Split, cell, terminal window

**Tab**:
A container holding one or more panes as a split layout tree, plus that tab's chrome (name, dot color). Closing a tab disposes every pane inside it.
_Avoid_: Window, session, workspace

**Focused pane**:
The pane that currently receives keyboard input and shortcut actions within a tab. One focused pane per tab at a time.
_Avoid_: Active pane, selected pane, cursor pane

**Layout**:
The split-tree structure of panes within a tab: nested row/column splits, each with a size ratio. Preserved across session restore and closed-tab reopen; only pane IDs and PTY sessions are recreated fresh.
_Avoid_: Grid, arrangement, split count

**Busy**:
A pane whose foreground process is something other than an idle shell (e.g. `claude`, `vim`). A pane at an idle shell prompt or in session-ended limbo (no foreground process) is not busy.
_Avoid_: Running, active, has output

**CWD**:
The current working directory of a pane's shell, as reported by the PTY. New panes and new tabs inherit the focused pane's CWD at spawn time; missing or invalid paths fall back to `$HOME`.
_Avoid_: Directory, path, folder

**Buffer**:
The scrollback history above the current prompt line in a pane. Clearing the buffer (Cmd+K) drops scrollback but keeps the current prompt line; the action is destructive with no undo.
_Avoid_: Screen, viewport, terminal output

**Closed tab snapshot**:
An in-memory record captured when a tab closes: split layout, per-pane CWDs, tab name, and dot color. Reopening (Cmd+Shift+T) restores layout and spawns fresh shells at saved CWDs; scrollback and running processes are not restored. Max 10 entries, not persisted across restarts.
_Avoid_: Undo, session backup, history

**Session**:
The persisted app state written to `session.json`: tab layouts, active tab index, and tab name/dot-color overrides. Restored on launch when enabled. Captures layout chrome only — not working state: each pane spawns a fresh shell at `$HOME`, CWDs are not saved. Independent from the in-memory closed-tab stack (which does preserve CWDs).
_Avoid_: Closed tab snapshot, workspace, profile

**Agent**:
An AI-agent CLI that Stackgrid recognizes by foreground process name (e.g. `claude`, `codex`, `gemini`). Recognition drives pane-header styling only; other processes are not agents.
_Avoid_: Process, CLI, bot

**Close pane**:
The action of closing the focused pane (Cmd+W). When the tab has only one pane, routes to close tab instead of respawning a shell.
_Avoid_: Close window, kill process

**Close tab**:
The action of closing an entire tab and all its panes (Cmd+Shift+W, or Cmd+W when the tab has a single pane). Prompts only when any pane is busy. Closing the last tab quits the app — no extra confirmation beyond the busy guard.
_Avoid_: Close window

**Quit**:
Exiting the Stackgrid application entirely. Triggered by Cmd+Q, the window close button, or closing the last tab.
_Avoid_: Close tab, close pane

**Search**:
Incremental, case-insensitive find in the focused pane's scrollback (Cmd+F). Scoped to one pane at a time; only one search bar may be open across the app.
_Avoid_: Filter, grep, global search
