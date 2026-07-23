---
derived: true
derived_from:
  [0003, 0007, 0008, 0010, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0027]
rendered: 2026-07-24
---

# BUSINESS-FLOW — Stackgrid

States, rules, and invariants for v1 product behavior. Complements `PRD.md`; does not replace PRINCIPLES.

## States

### Application

| State           | Meaning                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cold launch** | App starting; may load persisted multi-window session chrome if restore is enabled and data exists.                                                  |
| **Open board**  | User must choose workspace + layout preset before a real layout is shown. Entered on New Window, missing/disabled session restore, or empty session. |
| **Running**     | One or more windows exist with tabs/panes backed by PTYs.                                                                                            |
| **Quitting**    | App exiting after last window is gone or explicit Quit.                                                                                              |

### Window

| State                 | Meaning                                                                        |
| --------------------- | ------------------------------------------------------------------------------ |
| **Open-board window** | New window showing Open board; no working tabs yet (or equivalent pre-layout). |
| **Active window**     | Has ≥1 tab; participates in session chrome persistence.                        |
| **Closing**           | Last tab of this window closed → window closes; other windows unaffected.      |

### Tab / layout

| State                  | Meaning                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Materializing**      | Preset (or restore) applied; panes spawning shells at resolved CWDs.                                                |
| **Agent-pick pending** | After materialize or session restore: panes await agent/Shell/Skip-all. One-shot per pane for that materialization. |
| **Live**               | Normal use: focus, split, swap, drag-dock, move across windows.                                                     |
| **Preset editing**     | Mini layout mock open for designing a preset (not the live PTY layout).                                             |

### Pane

| State            | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| **Idle shell**   | Foreground is idle shell (or session-ended limbo) — not busy.              |
| **Busy**         | Foreground process is not an idle shell (agent or other).                  |
| **Agent-styled** | Foreground process name matches a recognized agent — header/badge styling. |
| **Picker**       | Overlay/chooser visible for agent vs Shell (during agent-pick pending).    |

### Agent phase (per-pane)

Two independent per-pane axes track agent attention: **Agent phase** below is the
runtime work signal; **Attention** (next table) is a separate, latched, actionable
state — a pane can be `Working` while still carrying a latched `Warning`. Each pane
also carries its own **Unread** boolean (output not yet seen while its window is
foregrounded), additive to and independent from the legacy tab-level unread flag
(`TabView.unread`, unaffected — see Rule 41).

| State       | Meaning                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Unknown** | No signal yet, or the pane's foreground process has not (or no longer) been confirmed as a recognized agent — the process gate is closed. |
| **Idle**    | Recognized agent confirmed; not currently producing working output/progress.                                                              |
| **Working** | Recognized agent actively producing output/progress (explicit OSC 9;4 progress, or the sustained-output heuristic).                       |
| **Exited**  | The pane's PTY is gone; its attention record is pruned.                                                                                   |

### Attention (per-pane, latched)

| State         | Meaning                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **None**      | No latched actionable state.                                                                          |
| **Completed** | A `working → idle` transition observed after a real working streak (explicit OSC clear or heuristic). |
| **Requested** | OSC 9 / OSC 777 notification, or terminal bell, from a gate-open (recognized-agent) pane.             |
| **Warning**   | OSC 9;4 progress state `4` from a gate-open pane.                                                     |
| **Error**     | OSC 9;4 progress state `2` from a gate-open pane.                                                     |

### Sidebar

| State              | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| **Closed**         | Default.                                                       |
| **Open (preview)** | Showing file content; Markdown rendered when applicable.       |
| **Open (diff)**    | Showing git diff for the file when git context exists.         |
| **Blocked**        | Path missing/unresolvable — toast/error; sidebar stays closed. |

### Preset store

| State                                          | Meaning                                                      |
| ---------------------------------------------- | ------------------------------------------------------------ |
| **Empty / populated**                          | Named presets on disk (split tree + optional per-pane CWDs). |
| **Saving / renaming / deleting / overwriting** | User-managed CRUD transitions.                               |

## Rules

### Launch & Open board

1. **New Window** always presents the Open board (workspace ∥ preset).
2. **Relaunch** with restore on + saved chrome → restore **all windows’** layout chrome; do **not** restore CWDs or processes; then enter **agent-pick pending** on each restored pane.
3. Relaunch with restore off / no session → Open board.
4. Open board requires a **workspace folder** and a **layout preset**. If the user has no saved presets, a **built-in default** (single-pane layout, no preset CWD) is always available so Open cannot soft-lock. Confirm **Open** materializes one tab/layout in that window.
5. **Workspace** means a local folder (recents + Open Folder), Cursor-style — not a Window/Tab/Session synonym.

### CWD resolution

6. When opening from a preset: pane CWD = preset pane CWD if set; else **workspace folder** chosen on the Open board.
7. Session restore spawn CWD = `$HOME` (ADR 0010) — presets do not rewrite `session.json`.
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

### Agent attention

35. **Process gate**: `Agent phase` and `Attention` only respond to a pane once its foreground process has been confirmed as a recognized agent by the existing `pty_info` poll (see Pane state table, `Agent-styled`; ARCHITECTURE `pty_info`). OSC 9;4 progress, the sustained-output heuristic, OSC 9/777 notification, and the terminal bell observed before that confirmation, or after the pane reverts to a shell, are discarded and never replayed once the gate reopens. Per-pane `Unread` is **not** gated by this check — it tracks output visibility regardless of the foreground process.
36. **Phase and attention are two independent axes**: `Agent phase` (`unknown`/`idle`/`working`/`exited`) is the runtime work signal; `Attention` (`none`/`completed`/`requested`/`warning`/`error`) is a separate latched state. A pane can be `working` while still carrying a latched `warning` that has not been acknowledged; the status mark shows attention ahead of phase.
37. **Explicit signals outrank the heuristic**: OSC 9;4 progress severity, OSC 9/777 notification, and the bell always outrank the sustained-output heuristic. The heuristic may only ever produce `working → idle → completed`; it must never latch `warning`, `error`, or `requested`.
38. **Completion requires a real working streak**: an OSC clear or an idle observation with no prior `working` transition is just `idle`, never `completed`.
39. **Warning/error/requested latch until acknowledged**: ending the underlying `working` phase (e.g. an OSC clear) does not itself clear a latched `warning`/`error`/`requested`; only acknowledging the pane (Rule 41) clears it.
40. **Attention precedence**: when several panes carry attention, the mark shown and the navigation order (Rule 41) both use `error > warning > requested > completed`, then oldest-changed first; unread-only panes are never selected by that navigation.
41. **Per-pane acknowledge is additive, distinct from legacy tab-level unread clearing**: focusing a pane — by click, or via `Cmd+Shift+A` / status-mark navigation — clears that pane's own `Attention` (back to `none`) and its own per-pane `Unread`. It never clears `Agent phase`. **Opening or selecting a tab still only clears that tab's legacy unread flag** through the existing public `selectTab()` call, exactly as before — selecting a tab does **not** acknowledge any pane's attention or per-pane unread, and pane focus does **not** clear the legacy tab-level unread flag. The two unread concepts run side by side; neither replaces the other.
42. **Notification is opt-in and background-only**: native OS notification defaults to off and is enabled only by an explicit Settings toggle; a denied OS permission keeps the setting `false`. It fires only while the Stackgrid window is not focused — the in-app status marks are the primary channel while the app is foregrounded.
43. **One notification per transition**: each attention transition sends at most one native notification, deduped by pane + revision; a later re-render or poll of the same transition never sends a duplicate.
44. **No terminal content in notifications**: notification copy is limited to the workspace label, a normalized agent/process label, and a fixed kind string (`finished` / `needs attention` / `warning` / `error`) — never raw terminal or model text.

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
10. **Acknowledge clears `Attention` and per-pane `Unread`, never `Agent phase`** — focusing a pane never marks a still-working agent as done, and never fabricates work it isn't doing.
11. **Per-pane attention/unread is additive, never a replacement for legacy tab-level unread** — `TabView.unread` and its clearing via the public `selectTab()` call keep their existing meaning and behavior unchanged.
12. **Attention state lives only in memory for the life of the PTY** — it is not persisted to `session.json` or any other artifact and does not survive an app restart.
13. **Stackgrid never parses terminal or model text for attention** — only protocol signals (OSC 9;4, OSC 9/777, bell) and the sustained-output heuristic feed `Agent phase`/`Attention`; no regex over rendered strings like "Allow?" or "Done".
