# Stackgrid

A minimal macOS terminal for AI agent CLIs. The UI hierarchy is Window → Tab → Pane.

## Language

**Window**:
A single Stackgrid OS window owning its own tabs and panes. Multi-window is in v1 scope: panes can move between windows; each window’s layout chrome participates in session restore.
_Avoid_: Tab, app, workspace (folder)

**Workspace**:
A local folder the user picks as the working root on the Open board (recent folders + Open Folder, Cursor-style). Supplies the default CWD when a layout preset pane has no CWD set. 1:1 with a Tab — it is the tab's identity, fixed for the tab's life, and held in memory for the tab's life (not persisted; the folder is remembered in `workspaces.json` recents and reopened by hand from the board). Reopening a workspace that already has a tab focuses that tab instead of creating a second one. A pane's live CWD is not the workspace: `cd` inside a terminal never changes it. Not an OS window.
_Avoid_: Window, session, folder-of-the-moment

**Pane**:
A single visible terminal region backed by exactly one PTY. Every tab has at least one pane; splitting adds more panes — it does not change what a pane is.
_Avoid_: Split, cell, terminal window

**Tab**:
A container holding one or more panes as a split layout tree, plus that tab's chrome (name, dot color) and the Workspace it belongs to. Closing a tab disposes every pane inside it.
_Avoid_: Window, session

**Focused pane**:
The pane that currently receives keyboard input and shortcut actions within a tab. One focused pane per tab at a time.
_Avoid_: Active pane, selected pane, cursor pane

**Layout**:
The split-tree structure of panes within a tab: nested row/column splits, each with a size ratio. Preserved across closed-tab reopen (Cmd+Shift+T); only pane IDs and PTY sessions are recreated fresh. On screen, a LayoutEngine maps the structural tree to the flex DOM (Focus Expand overlay, zoom, dividers) without changing what a Layout is.
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

**Materialize**:
Turning a Layout (plus optional per-pane CWDs) into a live Tab with fresh shells. Used by Open board confirm, Closed tab reopen, and Layout preset create. CWD policy is explicit: fresh, polled, none, or caller-given. On Open board confirm the chosen agent is typed into every new pane's shell once it is ready (see **Agent launch**).
_Avoid_: Restore, open, spawn (alone)

**Closed tab snapshot**:
An in-memory record captured when a tab closes: split layout, per-pane CWDs, tab name, and dot color. Reopening (Cmd+Shift+T) restores layout and spawns fresh shells at saved CWDs; scrollback and running processes are not restored. Max 10 entries, not persisted across restarts.
_Avoid_: Undo, session backup, history

**Session restore** (removed in 0.4.0):
Stackgrid no longer persists or restores tabs across launches. Quitting drops every tab and pane; the app always opens on the Open board, and the user reopens folders by hand from Recents (`workspaces.json`). `session.json`, `session-schema`, and `session-persistence` are gone. Only settings, layout presets, workspace recents, and the app logo persist across restarts; the closed-tab stack (Cmd+Shift+T) lives in memory for the session only.
_Avoid_: Closed tab snapshot, workspace, profile, layout preset

**Layout preset**:
A named, persisted template: split-tree layout plus optional per-pane CWDs. Edited via a mini layout mock (confirm → new tab) or saved from a live layout. Supports rename, delete, overwrite.
_Avoid_: Session, workspace, theme preset

**Open board**:
The sole entry point of the app (also shown for New Tab): three columns — the workspace sidebar (app chrome), a center logo panel (drag-drop an image to change it), and a right column stacking recent workspaces → layout preset → agent CLI. A recent row remembers its last layout + agent combo and preselects them. Confirm Open materializes the layout and launches the chosen agent on every pane.
_Avoid_: Settings, session restore

**Agent**:
An AI-agent CLI. For chrome: recognized by foreground process name (e.g. `claude`, `codex`, `gemini`) for pane-header styling. For launch: binaries discovered on the login shell's `PATH` and chosen on the board. Other processes are not agents.
_Avoid_: Process, CLI, bot

**Agent launch**:
Running the board's chosen agent in every new pane by typing `<agent>\r` into the pane's interactive shell once it prints its first byte (or after a 3s fallback), not by spawning it from Rust — the interactive shell inherits the correct `$PATH` that `$SHELL -lc` would strip. `Shell only` types nothing. Each pane is typed into exactly once; a failed write leaves the pane as a plain shell. Closed-tab reopen does not re-launch the agent.
_Avoid_: Spawn, agent picker

**Swap pane**:
Exchange the positions of two panes in a layout; each pane’s PTY/session moves with it. Distinct from drag-dock rearrange.
_Avoid_: Drag-dock, split, move to window

**Move to window**:
Detach a pane into another OS window (including a new window) or join it into a tab in another window. Bidirectional. Does not prompt when busy.
_Avoid_: Close pane, swap pane

**File sidebar**:
Right-hand read-only viewer opened by Cmd+click on a filepath in CLI output. Shows content preview (Markdown for `.md`) and git diff when available. Relative paths resolve against the source pane’s CWD; missing paths do not open the sidebar.
_Avoid_: Editor, embed agent UI

**Close pane**:
The action of closing the focused pane (Cmd+W). When the tab has only one pane, routes to close tab instead of respawning a shell.
_Avoid_: Close window, kill process

**Close tab**:
The action of closing an entire tab and all its panes (Cmd+Shift+W, or Cmd+W when the tab has a single pane). Prompts only when any pane is busy. Closing the last tab of a window closes that window; closing the last tab of the last window quits the app — no extra confirmation beyond the busy guard.
_Avoid_: Close window

**Quit**:
Exiting the Stackgrid application entirely. Triggered by Cmd+Q, closing the last window, or closing the last tab of the last window.
_Avoid_: Close tab, close pane

**Search**:
Incremental, case-insensitive find in the focused pane's scrollback (Cmd+F). Scoped to one pane at a time; only one search bar may be open across the app.
_Avoid_: Filter, grep, global search
