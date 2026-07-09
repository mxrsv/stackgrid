# BUSINESS-FLOW — Stackgrid

States, rules, and invariants for v1 product behavior. Complements `PRD.md`; does not replace PRINCIPLES.

## States

### Application

| State | Meaning |
| --- | --- |
| **Cold launch** | App starting; may load persisted multi-window session chrome if restore is enabled and data exists. |
| **Open board** | User must choose workspace + layout preset before a real layout is shown. Entered on New Window, missing/disabled session restore, or empty session. |
| **Running** | One or more windows exist with tabs/panes backed by PTYs. |
| **Quitting** | App exiting after last window is gone or explicit Quit. |

### Window

| State | Meaning |
| --- | --- |
| **Open-board window** | New window showing Open board; no working tabs yet (or equivalent pre-layout). |
| **Active window** | Has ≥1 tab; participates in session chrome persistence. |
| **Closing** | Last tab of this window closed → window closes; other windows unaffected. |

### Tab / layout

| State | Meaning |
| --- | --- |
| **Materializing** | Preset (or restore) applied; panes spawning shells at resolved CWDs. |
| **Agent-pick pending** | After materialize or session restore: panes await agent/Shell/Skip-all. One-shot per pane for that materialization. |
| **Live** | Normal use: focus, split, swap, drag-dock, move across windows. |
| **Preset editing** | Mini layout mock open for designing a preset (not the live PTY layout). |

### Pane

| State | Meaning |
| --- | --- |
| **Idle shell** | Foreground is idle shell (or session-ended limbo) — not busy. |
| **Busy** | Foreground process is not an idle shell (agent or other). |
| **Agent-styled** | Foreground process name matches a recognized agent — header/badge styling. |
| **Picker** | Overlay/chooser visible for agent vs Shell (during agent-pick pending). |

### Sidebar

| State | Meaning |
| --- | --- |
| **Closed** | Default. |
| **Open (preview)** | Showing file content; Markdown rendered when applicable. |
| **Open (diff)** | Showing git diff for the file when git context exists. |
| **Blocked** | Path missing/unresolvable — toast/error; sidebar stays closed. |

### Preset store

| State | Meaning |
| --- | --- |
| **Empty / populated** | Named presets on disk (split tree + optional per-pane CWDs). |
| **Saving / renaming / deleting / overwriting** | User-managed CRUD transitions. |

## Rules

### Launch & Open board

1. **New Window** always presents the Open board (workspace ∥ preset).
2. **Relaunch** with restore on + saved chrome → restore **all windows’** layout chrome; do **not** restore CWDs or processes; then enter **agent-pick pending** on each restored pane.
3. Relaunch with restore off / no session → Open board.
4. Open board requires a **workspace folder** and a **layout preset**. If the user has no saved presets, a **built-in default** (single-pane layout, no preset CWD) is always available so Open cannot soft-lock. Confirm **Open** materializes one tab/layout in that window.
5. **Workspace** means a local folder (recents + Open Folder), Cursor-style — not a Window/Tab/Session synonym.

### CWD resolution

6. When opening from a preset: pane CWD = preset pane CWD if set; else **workspace folder** chosen on the Open board.
7. Session restore spawn CWD = `$HOME` (or existing restore contract) — presets do not rewrite `session.json`.
8. New split / new tab at runtime inherits focused pane CWD (existing behavior).
9. Closed-tab reopen may restore CWDs **in memory only** (existing behavior).

### Agent picker

10. Picker options = agent CLIs **detected on `PATH`** + **Shell only**. No mandatory user configuration in v1.
11. Choosing an agent **spawns that command immediately** in the pane.
12. Choosing Shell leaves an idle login shell.
13. **Skip all**: every pane still pending → Shell; panes already chosen keep their spawn.
14. Picker is **one-shot** per materialization (Open or restore). Dismissed/skipped panes do not re-prompt until a new Open/restore cycle.

### Layout presets

15. Presets are a **separate persisted artifact** from `session.json`.
16. A preset stores: split tree + optional per-pane CWDs; may include tab chrome fields if product later needs them — v1 minimum is tree + CWD map.
17. User may **save** the current live layout as a named preset; **rename / delete / overwrite** supported.
18. Mini mock: edit a layout model → confirm → **opens a new tab** with that layout (does not “apply over” the current tab in place).
19. Saving from live layout does **not** require the mini mock.

### Pane movement

20. **Swap**: exchange two panes’ places in the layout; PTYs/sessions move with them.
21. **Move to new window** / **move or join to another window/tab**: bidirectional; process keeps running.
22. Swap and cross-window move **do not** show busy confirmation.
23. **Close pane / close tab** keep the busy guard (confirm when any relevant pane is busy).
24. Close last pane in a tab → close tab (existing routing).
25. Close last tab in a window → **close that window** (not the whole app if other windows remain).
26. Close last tab/window of the **app** → quit (busy guard still applies). Explicit Quit (Cmd+Q / window close on last window) same end state.

### Sidebar / paths

27. Cmd+click filepath in CLI output targets the **focused (source) pane’s** path context.
28. Relative paths resolve against that pane’s **CWD**; absolute paths used as-is.
29. If the resolved path does not exist → error/toast; **sidebar does not open**.
30. If it exists → open right sidebar: content preview (Markdown for `.md`) and git diff when git metadata is available.
31. Sidebar is **read-only** — no edit/save back to disk in v1.

### Privacy & platform

32. No telemetry by default; terminal contents and session/preset data stay on device unless the user explicitly sends them elsewhere (PRINCIPLES).
33. macOS only for v1 product commitment.
34. v1 may ship **unsigned**; Gatekeeper first-run friction is accepted.

## Invariants

1. **Every pane has exactly one real PTY** (login shell or child process tree) — no fake terminal surfaces for agent work.
2. **`session.json` (or multi-window equivalent) never persists pane CWDs or process identity** — only layout chrome (tabs, split structure, names, colors, window set). Preset files are the only persisted CWD templates.
3. **Busy ⇒ confirm only on destructive close**, never on swap/move/detach.
4. **Agent recognition for chrome** and **agent spawn list** may differ in mechanism, but both stay local/PATH-based in v1 — no cloud agent catalog.
5. **Sidebar never mutates the file** it previews.
6. **Open board before work** for New Window; restore path never skips the one-shot agent picker.
7. **App quit ⟺ no windows left** (or explicit Quit). Closing a non-last window never quits the app.
8. **Workspace ≠ Window ≠ Session** in language: workspace = folder; window = OS window; session = persisted chrome.
9. Features in v1 must not contradict PRINCIPLES (agent-CLI first, macOS, mouse+keyboard, real PTY, local-by-default, MIT, session-chrome-not-CWD).
