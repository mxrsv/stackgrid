---
derived: true
derived_from:
  [0001, 0002, 0003, 0005, 0007, 0010, 0012, 0020, 0021, 0022, 0023, 0024, 0025]
rendered: 2026-07-10
---

# ARCHITECTURE — Stackgrid

Derived view of the current and v1 target architecture. Rendered from the active ADR set (principles + product + architecture decisions) and a brownfield scan of the shipped codebase. English-only.

## 1. Stack

| Layer           | Choice                                         | Notes                                                                     |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Shell           | Tauri 2 (macOS only)                           | Overlay titlebar; unsigned v1 OK                                          |
| Backend         | Rust, thin                                     | `portable-pty`, `libc` process introspection, shell-out `git`             |
| UI framework    | Preact 10                                      | Chrome only (tab bar, status bar, settings, Open board, sidebar, pickers) |
| Reactivity      | `@preact/signals`                              | Per-webview module signals                                                |
| Terminal render | xterm.js 6 + Fit / Search / Unicode / WebLinks | Imperative DOM — never inside Preact’s tree                               |
| Persist         | `@tauri-apps/plugin-store`                     | `settings.json`, `session.json`, `presets.json`                           |
| Dialogs         | `@tauri-apps/plugin-dialog`                    | Busy/quit confirms                                                        |

**Pattern:** hybrid. Preact owns chrome; `TabManager` / `TerminalManager` / `Pane` own imperative terminal surfaces and talk to Rust over Tauri IPC.

**Stack ADR:** `docs/decisions/0025-v1-stack-tauri-preact-xterm.md` — the stack is the v1 foundation but **revisable** (not a non-negotiable; Electron not forbidden).

## 2. Brownfield vs net-new

### Shipped (keep)

- Real PTY + login shell (`$SHELL -l`) via `portable-pty` (`src-tauri/src/pty.rs`)
- Single-window Window → Tab → Pane hierarchy
- Split, drag-dock rearrange, divider resize, focus cycle / directional focus, focus-expand, zoom
- Session chrome restore (`session.json` layout only — ADR 0010)
- In-memory closed-tab stack with CWDs (max 10)
- Agent/busy chrome from foreground process name (`claude` / `codex` / `gemini`)
- Themes + settings persist; git branch in status bar; file-drop → PTY; Cmd+F search; busy/quit guards

### Net-new (v1 gap)

- Multi-window create / move-join / restore-all
- Pane swap (exchange two leaves; PTYs follow ids)
- Open board (workspace ∥ layout preset)
- Layout presets CRUD + mini mock → new tab
- Post-materialize / post-restore one-shot agent picker
- PATH allowlist detect + immediate spawn on pick
- File sidebar: Cmd+click path → preview (+ Markdown) + git diff

## 3. Layer / module map

```
src-tauri/src/
  lib.rs          bootstrap, plugins, quit gate, (v1) window coordinator hooks
  pty.rs          PtyState registry — keyed by pane-id (== PTY id)
  info.rs         pty_info, git_branch; (v1) read_file_preview, git_diff, detect_agents
  menu.rs         macOS native menu
  (v1) window.rs  optional: WebviewWindow lifecycle + pane→window ownership map

src/
  main.tsx / ui/  Preact chrome (App, tab bar, status bar, settings)
  terminal/       imperative domain: TabManager, TerminalManager, Pane, layout, keymap
  settings/       settings schema + store + color themes
  lib/            pure: split-tree, session-schema, process-info, geometry, …
  (v1) open-board/, presets/, sidebar/, agent-picker/   new chrome modules
```

**Ownership today:** one `TabManager` per webview owns tabs; each tab has a `TerminalManager` (`tree` + `Map<paneId, Pane>`); Rust `PtyState` owns live PTYs.

**Ownership v1:** same per-webview layout ownership, plus an **app-level Rust coordinator** that owns `pane-id → window-id` and fans out PTY events (see §5).

## 4. Locked seams (shared with UX-DESIGN)

These are product/architecture invariants — both sibling docs assume the same model:

1. **PTY registry lives in Rust**, keyed by a stable **pane-id**, independent of which webview/window is showing the pane.
2. **Layout = split-tree of pane-ids.** A webview attaches xterm to a PTY by id (`write_pty` / `pty:output` / resize / kill).
3. **Swap** = exchange two pane-ids in the tree; PTY sessions are untouched.
4. **Move-across-window** = remove pane-id from window A’s tree, insert into window B’s tree; PTY keeps running in the registry; coordinator updates ownership.
5. **`session.json` = chrome only** (per-window tab trees, names, colors, window set). No CWD, no process identity.
6. **Layout preset = separate artifact** (tree + optional per-pane CWD map).

## 5. Decisions (chosen + rejected)

Each decision lists the chosen approach and the alternatives rejected during architecture elicitation.

### D1 — Multi-window coordination + IPC

**Chosen: Rust app-level coordinator.**

- `PtyState` remains the PTY registry (already shipped).
- Add ownership map `pane_id → window_label` (or equivalent) managed in Rust.
- `pty:output` / `pty:exit` are emitted **to the owning window** (targeted), not blindly to every webview.
- Move-across-window = one command: reassign ownership + notify both webviews to detach/attach xterm; do not kill PTY.
- Closing a window kills only PTYs still owned by that window (after busy guard on close paths); panes moved away are unaffected.

**Rejected:**

- _Each window self-manages + broadcast all PTY events_ — race-prone ownership, easy to orphan sessions.
- _Primary-webview hub for all layout_ — single point of failure; fights “each window owns its chrome.”

**ADR:** `docs/decisions/0001-rust-pty-window-coordinator.md`

### D2 — Pane-id model

**Chosen: pane-id ≡ PTY id (keep brownfield).**

- `spawn_shell` returns `u32`; that value is the leaf id in the split tree and the xterm routing key.
- Session / preset serialization **drops** ids (structure + ratios only); restore / Open assign fresh ids left-to-right via `treeFromLayout`.
- Swap = swap two leaf ids in the tree (pure tree transform; no PTY churn).
- Last-pane exit respawn keeps today’s `replaceLeaf(oldId, newId)` behavior.

**Rejected:**

- _Logical UUID pane-id separate from PTY id_ — double-key every IPC; v1 does not need identity across respawn/restart.
- _Persist pane-ids in session chrome_ — meaningless under fresh-shell restore; conflicts with ADR 0010 intent.

**ADR:** `docs/decisions/0020-pane-id-equals-pty-id.md`

### D3 — Session chrome + restore-all-windows

**Chosen: one `session.json`, multi-window schema (version bump).**

```text
SessionData v2 (conceptual)
  version: 2
  windows: [
    { id, tabs: [{ layout, name?, dotColor? }], activeTab }
  ]
  focusedWindowId?
```

- Cold launch with restore on: create N `WebviewWindow`s from `windows[]`, materialize each tree with fresh shells at `$HOME`, then enter **agent-pick pending** on every pane.
- Debounced save aggregates chrome from all windows (coordinator or FE snapshots → single write).
- Migrate v1 flat `{ version: 1, tabs, activeTab }` → single-window v2 on first load.

**Rejected:**

- _Per-window session files + manifest_ — more failure modes for atomic restore-all.
- _Persist only the focused window_ — violates PRD / BUSINESS-FLOW restore-all.

**ADR:** `docs/decisions/0002-multi-window-session-chrome.md`

### D4 — Preset persistence

**Chosen: separate `presets.json` via plugin-store.**

```text
PresetsData v1 (conceptual)
  version: 1
  presets: [
    { id, name, layout: SerializedNode, cwds?: (string | null)[] }
  ]
```

- CWD array zips leaves left-to-right (same convention as closed-tab snapshots).
- Built-in default preset (single pane, no CWD) is **code-defined**, always available on the Open board so Open cannot soft-lock.
- CRUD: save from live layout, rename, delete, overwrite; mini mock confirms → **new tab** (does not replace in place).

**Rejected:**

- _Embed presets in `settings.json`_ — mixes preferences with layout templates.
- _One file per preset on disk_ — unnecessary given plugin-store; weaker atomic overwrite.

**ADR:** `docs/decisions/0021-preset-persistence-presets-json.md`

### D5 — Sidebar data plane

**Chosen: Rust reads file + shell-outs `git`; frontend renders only.**

| Concern                                                    | Owner                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Resolve path (absolute as-is; relative vs source pane CWD) | Frontend (from polled `pty_info`)                                                    |
| Existence check + capped file read                         | Rust `read_file_preview`                                                             |
| Git diff for one path                                      | Rust `git_diff` via `git -C <cwd> diff -- <path>` (same trust model as `git_branch`) |
| Markdown render for `.md`                                  | Frontend markdown library                                                            |
| Plain / diff text view                                     | Frontend                                                                             |
| Missing path                                               | Error/toast; sidebar stays closed                                                    |

**Rejected:**

- _Frontend fs plugin for reads + Rust git_ — extra capability surface, two I/O paths.
- _Embed libgit2/gitoxide_ — heavy; inconsistent with existing `git_branch` shell-out.

**ADR:** `docs/decisions/0022-sidebar-data-plane.md`

### D6 — Agent PATH detect + spawn

**Chosen: hardcoded allowlist + Rust PATH lookup; pick spawns immediately.**

- Allowlist aligned with chrome recognition: `claude`, `codex`, `gemini` (extend later without settings UI).
- `detect_agents` → `[{ name, path }]` for binaries found on `PATH`.
- Picker options = detected agents + **Shell only** + **Skip all**.
- Choosing an agent writes/spawns that command in the pane’s shell **immediately**; Shell leaves idle login shell; Skip all → remaining pending panes stay shells; already-picked panes unchanged.
- One-shot per materialization (Open or restore). Chrome styling remains foreground process-name match (shipped).

**Rejected:**

- _Heuristic scan of all PATH binaries_ — noisy, slow, un-minimal.
- _User-configurable agent list in settings_ — deferred (PRD Later).

**ADR:** `docs/decisions/0023-agent-path-detect-allowlist.md`

### D7 — Signals / module-store at multi-window scale

**Chosen: per-webview signals + plugin-store reload via app events.**

- Each OS window is its own JS context → module signals (`tabViews`, `statusInfo`, local tab manager) stay local — correct isolation.
- Shared artifacts (`settings.json`, `presets.json`) : writer emits app-wide events (`settings-changed`, `presets-changed`); other windows reload.
- `session.json` : aggregate chrome from all windows on debounce (see D3); not a per-signal global.
- PTY traffic never goes through signals — still Rust events → owning webview → `TerminalManager.handleOutput`.

**Rejected:**

- _Lift all UI state into Rust_ — rewrite; fights imperative xterm layer.
- _SharedWorker / BroadcastChannel between webviews_ — unreliable under WKWebView/Tauri; still need Rust for PTY ownership.

**ADR:** `docs/decisions/0024-signals-module-store-multi-window.md`

### D8 — Quit semantics (product amendment)

**Chosen: last tab of a window closes that window; app quits when no windows remain (or explicit Quit).**

Supersedes single-window pre-pipeline quit behavior. Busy guard still applies on close paths only (never on swap/move).

**ADR:** `docs/decisions/0003-last-window-close-quits-app.md` (replaces pre-pipeline `docs/adr/0002-last-tab-close-quits-app.md`)

## 6. Data flows (main journeys)

### Open → materialize → picker

```text
New Window / no session / restore off
  → Open board (workspace folder ∥ layout preset)
  → Confirm Open
  → Resolve per-pane CWD: preset cwd if set else workspace folder
  → spawn_shell(cwd) per leaf → treeFromLayout(ids)
  → Agent-pick pending (one-shot)
  → Pick agent → spawn command in pane | Shell | Skip all
  → Live
```

### Session restore-all

```text
Cold launch + restore on + session.json v2
  → Create N windows from windows[]
  → Per window: materialize layouts, spawn at $HOME (no CWD)
  → Agent-pick pending on every restored pane
  → Live
```

### Swap

```text
User selects swap of pane A ↔ B in same tab tree
  → Pure tree transform: exchange leaf ids
  → Re-render layout DOM; xterm instances follow ids
  → PTY registry untouched; no busy prompt
```

### Move-across-window

```text
User moves pane P from window A → window B (or new window)
  → Rust coordinator: ownership[P] = B
  → Window A: remove P from tree (no kill_pty)
  → Window B: insert P into target tab tree; attach xterm to existing PTY
  → Output/exit events now route to B
  → No busy prompt
```

### Cmd+click → sidebar

```text
Cmd+click filepath token in pane output
  → Resolve vs source pane CWD
  → Rust existence + read_file_preview
  → If missing: toast; sidebar stays closed
  → If ok: open sidebar; FE renders content (Markdown if .md)
  → Rust git_diff when cwd is inside a git work tree; FE shows diff view
  → Read-only (no write-back)
```

## 7. State ownership

| State                                   | Owner                         | Lifetime                              |
| --------------------------------------- | ----------------------------- | ------------------------------------- |
| Live PTY sessions                       | Rust `PtyState`               | Until `kill_pty` / process exit       |
| pane-id → window                        | Rust coordinator              | Until pane closed or app quit         |
| Split tree + pane map + focus           | Per-window `TerminalManager`  | Window lifetime                       |
| Tab list + overrides + closed-tab stack | Per-window `TabManager`       | Window lifetime (closed-tab RAM only) |
| Tab bar / status signals                | Per-webview `@preact/signals` | Webview lifetime                      |
| Settings                                | `settings.json` + signals     | Disk + reload events                  |
| Session chrome                          | `session.json` v2             | Disk; chrome only                     |
| Layout presets                          | `presets.json`                | Disk; separate from session           |
| Agent picker pending                    | Per-pane ephemeral UI flag    | One-shot after materialize/restore    |
| Sidebar open + content                  | Per-window UI state           | Until closed                          |

## 8. Artifact persistence

| Artifact                | File / place      | Contains                                                     | Does not contain                    |
| ----------------------- | ----------------- | ------------------------------------------------------------ | ----------------------------------- |
| Settings                | `settings.json`   | theme, font, restoreTabs, …                                  | layouts, CWDs                       |
| Session                 | `session.json` v2 | window set, per-window tab trees, names, colors, active tabs | CWD, PTY ids, processes, scrollback |
| Presets                 | `presets.json`    | named layouts + optional CWD maps                            | live session, window set            |
| Closed tabs             | in-memory stack   | layout + CWDs + chrome                                       | disk                                |
| Built-in default preset | code constant     | single-pane, no CWD                                          | —                                   |

## 9. IPC catalog

### Shipped commands

| Command                                 | Role                                      |
| --------------------------------------- | ----------------------------------------- |
| `spawn_shell`                           | Create PTY + login shell; returns pane-id |
| `write_pty` / `resize_pty` / `kill_pty` | I/O + lifecycle                           |
| `pty_info`                              | cwd + foreground process for ids          |
| `git_branch`                            | status-bar branch via shell-out `git`     |
| `confirm_quit`                          | confirmed app exit                        |

### Shipped events

| Event                     | Role                                           |
| ------------------------- | ---------------------------------------------- |
| `pty:output` / `pty:exit` | PTY → frontend (v1: targeted to owning window) |
| `quit-requested`          | ExitRequested / menu Quit → FE confirm         |

### Net-new commands / events (v1)

| API                                    | Role                               |
| -------------------------------------- | ---------------------------------- |
| `detect_agents`                        | Allowlist PATH lookup              |
| `read_file_preview`                    | Capped UTF-8 file read for sidebar |
| `git_diff`                             | Per-file diff via shell-out `git`  |
| `move_pane_ownership` (name TBD)       | Reassign pane-id → window          |
| `create_window` / window close hooks   | Multi-window lifecycle             |
| `settings-changed` / `presets-changed` | Cross-webview store reload         |

## 10. Split-tree contract

Runtime tree (`src/lib/split-tree.ts`): binary `leaf | split{dir, ratio, a, b}` with **pane ids on leaves**.

Serialized form (`SerializedNode`): ids stripped — `{ type: "leaf" }` or `{ type: "split", direction, ratio, first, second }`.

Restore / preset materialize: spawn N shells, `treeFromLayout(serialized, ids)` assigns ids left-to-right. Optional CWD maps use the same leaf order.

## 11. ADR index

| ADR                                                            | Topic                              | Kind / relation                        |
| -------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `docs/decisions/0001-rust-pty-window-coordinator.md`           | Rust ownership + targeted PTY IPC  | architecture (D1)                      |
| `docs/decisions/0002-multi-window-session-chrome.md`           | Single multi-window `session.json` | architecture (D3)                      |
| `docs/decisions/0003-last-window-close-quits-app.md`           | Quit = last window of app          | architecture (D8); replaces adr/0002   |
| `docs/decisions/0020-pane-id-equals-pty-id.md`                 | Pane-id ≡ PTY id                   | architecture (D2)                      |
| `docs/decisions/0021-preset-persistence-presets-json.md`       | Separate `presets.json`            | architecture (D4)                      |
| `docs/decisions/0022-sidebar-data-plane.md`                    | Rust reads + git shell-out         | architecture (D5)                      |
| `docs/decisions/0023-agent-path-detect-allowlist.md`           | Allowlist PATH detect + spawn      | architecture (D6)                      |
| `docs/decisions/0024-signals-module-store-multi-window.md`     | Per-webview signals + reload       | architecture (D7)                      |
| `docs/decisions/0025-v1-stack-tauri-preact-xterm.md`           | v1 stack (revisable)               | architecture (§1)                      |
| `docs/decisions/0005-macos-only-v1.md`                         | macOS only                         | principle (constrains stack)           |
| `docs/decisions/0007-real-pty-login-shell.md`                  | Real PTY + login shell             | principle (PTY registry)               |
| `docs/decisions/0010-session-restore-layout-chrome-not-cwd.md` | Session chrome without CWD         | principle (session schema)             |
| `docs/decisions/0012-multi-window-workspace-model.md`          | Multi-window product model         | product (drives coordinator + session) |
| `docs/adr/0001-session-restore-without-cwd.md`                 | Pre-pipeline session-chrome        | history; absorbed by ADR 0010          |
| `docs/adr/0002-last-tab-close-quits-app.md`                    | Pre-pipeline single-window quit    | history; replaced by ADR 0003          |

Rationale lives in the ADRs; this document records the chosen shape only.

## 12. Completeness check

Against PRINCIPLES: agent-CLI first, macOS, mouse+keyboard, real PTY, local-by-default, MIT, session-chrome-not-CWD — all reflected in seams and persistence.

Against PRD / BUSINESS-FLOW journeys: Open board → materialize → picker; restore-all + picker; swap; move-across-window; sidebar; presets — each has a data flow and owning layer.

Against brownfield: shipped modules named; net-new called out; session-chrome-without-CWD (ADR 0010) preserved. Some net-new modules (Rust coordinator, tab-materialize / layout-engine / close-coordinator seams) are actively landing in the codebase; this document tracks the decisions, not a code snapshot — see `CONTEXT.md` for current implementation state.
