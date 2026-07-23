---
derived: true
derived_from:
  [
    0001,
    0002,
    0003,
    0005,
    0007,
    0010,
    0012,
    0020,
    0021,
    0022,
    0023,
    0024,
    0025,
    0027,
  ]
rendered: 2026-07-24
---

# ARCHITECTURE — Stackgrid

Derived view of the current and v1 target architecture. Rendered from the active ADR set (principles + product + architecture decisions) and a brownfield scan of the shipped codebase. English-only.

> **0.4.0 supersede (current implementation).** Session persistence and the
> per-pane agent-picker overlay were **removed**. The Open board is now the sole
> entry point; quitting drops all tabs and the app reopens on the board, where
> the user restores folders from Recents. The board's chosen agent is launched
> by typing `<agent>\r` into each new pane's interactive shell once it is ready
> (module `terminal/agent-launch.ts`), never spawned from Rust. `session.json`,
> `session-schema`, `session-persistence`, `agent-picker/`, and
> `settings.restoreTabs` are gone; a new `logo.json` store (Rust command
> `read_image_as_data_url`) holds the app logo as a data URL. Where the sections
> below still describe session restore / the agent picker as live behavior, this
> note wins for the current code — those passages record earlier ADR decisions.

## 1. Stack

| Layer           | Choice                                         | Notes                                                                                       |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Shell           | Tauri 2 (macOS only)                           | Overlay titlebar; unsigned v1 OK                                                            |
| Backend         | Rust, thin                                     | `portable-pty`, `libc` process introspection, shell-out `git`                               |
| UI framework    | Preact 10                                      | Chrome only (tab bar, status bar, settings, Open board, sidebar, pickers)                   |
| Reactivity      | `@preact/signals`                              | Per-webview module signals                                                                  |
| Terminal render | xterm.js 6 + Fit / Search / Unicode / WebLinks | Imperative DOM — never inside Preact’s tree                                                 |
| Persist         | `@tauri-apps/plugin-store`                     | `settings.json`, `presets.json`, `workspaces.json`, `logo.json` (no `session.json` — 0.4.0) |
| Dialogs         | `@tauri-apps/plugin-dialog`                    | Busy/quit confirms                                                                          |

**Pattern:** hybrid. Preact owns chrome; `TabManager` / `TerminalManager` / `Pane` own imperative terminal surfaces and talk to Rust over Tauri IPC.

**Stack ADR:** `docs/decisions/0025-v1-stack-tauri-preact-xterm.md` — the stack is the v1 foundation but **revisable** (not a non-negotiable; Electron not forbidden).

## 2. Brownfield vs net-new

### Shipped (keep)

- Real PTY + login shell (`$SHELL -l`) via `portable-pty` (`src-tauri/src/pty.rs`)
- Single-window Window → Tab → Pane hierarchy
- Split, drag-dock rearrange, divider resize, focus cycle / directional focus, focus-expand, zoom
- In-memory closed-tab stack with CWDs (max 10)
- Agent/busy chrome from foreground process name (`claude` / `codex` / `gemini`)
- Themes + settings persist; git branch in status bar; file-drop → PTY; Cmd+F search; busy/quit guards

### Net-new (v1 gap)

- Multi-window create / move-join / restore-all
- Pane swap (exchange two leaves; PTYs follow ids)
- Open board (workspace ∥ layout preset ∥ agent), sole entry point (0.4.0)
- Layout presets CRUD + mini mock → new tab
- Agent launch: type the board's chosen agent into every new pane's shell on first output (0.4.0; replaces the removed per-pane agent picker)
- PATH allowlist detect on the board
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
  terminal/       imperative domain: TabManager, TerminalManager, Pane, layout, keymap,
                   AgentAttentionTracker, agent-notifier (terminal/agent-attention.ts,
                   terminal/agent-notifier.ts)
  settings/       settings schema + store + color themes
  lib/            pure: split-tree, process-info, workspace-recents, geometry,
                   osc-progress, osc-notification, native-notification, …
  open-board/, presets/, sidebar/   chrome modules; agent launch in terminal/agent-launch.ts
```

**Ownership today:** one `TabManager` per webview owns tabs; each tab has a `TerminalManager` (`tree` + `Map<paneId, Pane>`); Rust `PtyState` owns live PTYs. `TabManager` also owns one `AgentAttentionTracker` instance per webview (`createAgentAttentionTracker`, §5 D9) — a pure, in-memory reducer over the same `pty:output` / `PaneEvents` / `pty_info` inputs `TabManager` already consumes for `agentBusy`/legacy `unread`, plus pane focus.

**Ownership v1:** same per-webview layout ownership, plus an **app-level Rust coordinator** that owns `pane-id → window-id` and fans out PTY events (see §5).

## 4. Locked seams (shared with UX-DESIGN)

These are product/architecture invariants — both sibling docs assume the same model:

1. **PTY registry lives in Rust**, keyed by a stable **pane-id**, independent of which webview/window is showing the pane.
2. **Layout = split-tree of pane-ids.** A webview attaches xterm to a PTY by id (`write_pty` / `pty:output` / resize / kill).
3. **Swap** = exchange two pane-ids in the tree; PTY sessions are untouched.
4. **Move-across-window** = remove pane-id from window A’s tree, insert into window B’s tree; PTY keeps running in the registry; coordinator updates ownership.
5. **`session.json` = chrome + `workspacePath`** (per-window tab trees, names, colors, window set, and the workspace each tab belongs to). Still no per-pane CWD and no process identity. Restore spawns every pane of a tab at that tab's `workspacePath` — a tab labelled with a repo whose shell sits in `$HOME` would be lying; tabs from files that predate the field have no workspace and still fall back to `$HOME`.
6. **Layout preset = separate artifact** (tree + optional per-pane CWD map).
7. **Attention state is in-memory only, additive to the legacy contract.** `AgentAttentionTracker`'s per-pane `phase`/`attention`/`unread` never touch `session.json` or any other persisted artifact and do not survive a restart; `TabView.agentBusy`/`TabView.unread` and the public `selectTab()` clearing keep their exact shipped meaning (ADR 0027, §5 D9 below).

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

### D9 — Agent attention state pipeline + notification boundary

**Chosen: a pure `AgentAttentionTracker` owned by `TabManager`, fed by the existing PTY/process signals; native notification via `tauri-plugin-notification` behind a minimal capability.**

- `AgentAttentionTracker` (`src/terminal/agent-attention.ts`) is a **pure, in-memory, per-webview** reducer — no Tauri, no DOM, no settings import. It holds one `PaneAttentionSnapshot` per live pane: `phase: AgentPhase` (`unknown`/`idle`/`working`/`exited`, the runtime work signal) and `attention: AttentionKind` (`none`/`completed`/`requested`/`warning`/`error`, a separate latched, actionable state) — a pane can be `working` while still carrying a latched `warning`.
- **Inputs**, all already flowing into `TabManager` for the legacy `agentBusy`/`unread` contract — no new IPC surface:
  - `pty:output` → `AgentActivity`'s OSC 9;4 progress parser (state `2`→`error`, `4`→`warning`, clear→phase transition feeding `completed`) plus the existing sustained-output heuristic as a fallback. The heuristic may only ever produce `working → idle → completed`; it can never latch `warning`/`error`/`requested` — explicit protocol signals always outrank it.
  - `PaneEvents` → OSC 9 / OSC 777 notification and the terminal bell, parsed by xterm's own escape-sequence handling (`src/lib/osc-notification.ts`) and surfaced as `noteSignal(id, { kind: "requested", source, observedAt })`.
  - `pty_info` (existing poll) → `noteProcess(id, process, isAgent)`: the **process gate**. Every other input above is discarded unless the last poll recognized the pane's foreground process as an agent; a pane that reverts to a shell closes the gate and resets stale state, and nothing observed before the gate reopens is replayed.
  - Pane focus / window focus → `noteOutputVisibility` (per-pane unread) and `acknowledge(id)` on real DOM focus, independent of `TabView`'s legacy tab-level unread.
- **Aggregation**: `tracker.summarize(paneIds)` rolls a tab's panes into one `AgentAttentionSummary` (`kind` at precedence `error > warning > requested > completed > working > unread > idle`, plus `actionableCount`/`workingCount`/`unreadCount`) consumed by both chrome surfaces (sidebar `WorkspaceLogo` and the top `TabBar`) through the shared `AgentAttentionMark` component — one status-mark implementation, two chrome positions.
- **Navigation**: `TabManager.focusNextAttention(tabIndex?)` scans the same precedence order (ties broken oldest-`changedAt`-first) and focuses exactly one candidate pane per call, acknowledging it as a side effect of the focus; `src/ui/attention-focus-coordinator.ts` runs the same overlay preflight for both the status-mark click and the `Cmd+Shift+A` shortcut (keymap action `focus-next-attention`) so neither path can silently drop a `PresetEditor`/`SavePresetDialog` draft or focus an intermediate pane.
- **Notification boundary**: `src/terminal/agent-notifier.ts` is a pure, injectable policy (`AgentNotifierDeps`: `isEnabled`, `isWindowFocused`, `send`) that fires at most once per `(paneId, revision)` and only when the setting is on **and** the window is not focused. It calls `src/lib/native-notification.ts`, a thin adapter over `@tauri-apps/plugin-notification` (`isPermissionGranted` / `requestPermission` / `sendNotification`) that re-checks permission at send time (a fail-silent no-op if revoked) rather than trusting a cached flag. Tauri capability (`src-tauri/capabilities/default.json`) grants only `notification:allow-is-permission-granted`, `notification:allow-request-permission`, `notification:allow-notify` — no broader `notification:default`. Notification copy is limited to workspace label + normalized agent label + a fixed kind phrase (`finished`/`needs attention`/`warning`/`error`) — never raw terminal or model text.
- **State lifetime**: attention state lives only for the life of the PTY, in the same per-webview JS context as the rest of `TabManager`'s state (D7) — it is never written to `session.json`/`settings.json` or any other artifact, and does not survive an app restart (§4 seam 7).

**Rejected:**

- _Parsing rendered terminal text or model output_ ("Allow?", "Press Enter", "Done") to infer attention — unreliable across agents/locales and couples Stackgrid to CLI-specific UI copy; protocol signals (OSC 9;4/9/777, bell) plus a capped output heuristic instead.
- _Reusing `Busy` or the legacy tab-level unread flag as the acknowledge mechanism_ — would silently change close-guard and legacy-unread semantics other flows depend on; kept as two additive, independent axes.
- _Enabling native notification by default, or requesting OS permission at startup_ — spams users and trips the permission prompt before it's wanted; opt-in via Settings, prompted only on toggle.
- _Persisting attention as a run ledger/history in v1_ — turns a live coordination aid into an audit system prematurely.

**ADR:** `docs/decisions/0027-agent-attention-signals-and-ack.md`

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

### Agent attention signal → status mark → acknowledge

```text
pty_info poll confirms foreground process is a recognized agent
  → process gate opens for that pane
  → pty:output (OSC 9;4) | PaneEvents (OSC 9/777, bell) | sustained-output fallback
  → AgentAttentionTracker.note{Activity,Signal}(id, …) → PaneAttentionSnapshot
      (explicit signals outrank the heuristic; heuristic never latches warning/error/requested)
  → tracker.summarize(tab's paneIds) → AgentAttentionSummary
  → AgentAttentionMark (sidebar WorkspaceLogo + top TabBar) renders by precedence
  → deps.isEnabled && !isWindowFocused && kind !== "none" && revision > lastNotified
      → agent-notifier.maybeNotify → native-notification.send (permission re-checked)
  → user clicks status mark, or Cmd+Shift+A
      → attention-focus-coordinator preflight (blocked if PresetEditor/SavePresetDialog has a draft)
      → TabManager.focusNextAttention(tabIndex?) focuses exactly one candidate pane
      → tracker.acknowledge(id): clears that pane's attention + per-pane unread, phase untouched
  → pane's foreground process reverts to shell, or pty:exit
      → gate closes / record pruned; nothing before the next gate-open is replayed
```

Legacy `TabView.agentBusy`/`TabView.unread` and public `selectTab()` clearing are unaffected — they run alongside this flow, not through it (§4 seam 7).

## 7. State ownership

| State                                     | Owner                                                     | Lifetime                                                                |
| ----------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Live PTY sessions                         | Rust `PtyState`                                           | Until `kill_pty` / process exit                                         |
| pane-id → window                          | Rust coordinator                                          | Until pane closed or app quit                                           |
| Split tree + pane map + focus             | Per-window `TerminalManager`                              | Window lifetime                                                         |
| Tab list + overrides + closed-tab stack   | Per-window `TabManager`                                   | Window lifetime (closed-tab RAM only)                                   |
| Tab bar / status signals                  | Per-webview `@preact/signals`                             | Webview lifetime                                                        |
| Settings                                  | `settings.json` + signals                                 | Disk + reload events                                                    |
| Session chrome                            | `session.json` v2                                         | Disk; chrome + `workspacePath`                                          |
| Layout presets                            | `presets.json`                                            | Disk; separate from session                                             |
| Agent picker pending                      | Per-pane ephemeral UI flag                                | One-shot after materialize/restore                                      |
| Sidebar open + content                    | Per-window UI state                                       | Until closed                                                            |
| Agent phase / attention / per-pane unread | Per-webview `AgentAttentionTracker` (inside `TabManager`) | In-memory only, life of the PTY — never persisted, pruned on `pty:exit` |

## 8. Artifact persistence

| Artifact                | File / place         | Contains                                                 | Does not contain                           |
| ----------------------- | -------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Settings                | `settings.json`      | theme, font, tab bar position, editor, …                 | layouts, CWDs, restoreTabs (removed 0.4.0) |
| Workspace recents       | `workspaces.json` v2 | recent folders + each folder's last layout + agent combo | live tabs, PTY ids, scrollback             |
| App logo                | `logo.json`          | the app logo as a data URL (empty = default mark)        | the original image path                    |
| Presets                 | `presets.json`       | named layouts + optional CWD maps                        | live tabs, workspace recents               |
| Closed tabs             | in-memory stack      | layout + CWDs + chrome                                   | disk                                       |
| ~~Session~~             | ~~`session.json`~~   | removed in 0.4.0 — no tab/pane restore across launches   | —                                          |
| Built-in default preset | code constant        | single-pane, no CWD                                      | —                                          |

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

| ADR                                                            | Topic                                      | Kind / relation                        |
| -------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `docs/decisions/0001-rust-pty-window-coordinator.md`           | Rust ownership + targeted PTY IPC          | architecture (D1)                      |
| `docs/decisions/0002-multi-window-session-chrome.md`           | Single multi-window `session.json`         | architecture (D3)                      |
| `docs/decisions/0003-last-window-close-quits-app.md`           | Quit = last window of app                  | architecture (D8); replaces adr/0002   |
| `docs/decisions/0020-pane-id-equals-pty-id.md`                 | Pane-id ≡ PTY id                           | architecture (D2)                      |
| `docs/decisions/0021-preset-persistence-presets-json.md`       | Separate `presets.json`                    | architecture (D4)                      |
| `docs/decisions/0022-sidebar-data-plane.md`                    | Rust reads + git shell-out                 | architecture (D5)                      |
| `docs/decisions/0023-agent-path-detect-allowlist.md`           | Allowlist PATH detect + spawn              | architecture (D6)                      |
| `docs/decisions/0024-signals-module-store-multi-window.md`     | Per-webview signals + reload               | architecture (D7)                      |
| `docs/decisions/0025-v1-stack-tauri-preact-xterm.md`           | v1 stack (revisable)                       | architecture (§1)                      |
| `docs/decisions/0027-agent-attention-signals-and-ack.md`       | Attention pipeline + notification boundary | architecture (D9)                      |
| `docs/decisions/0005-macos-only-v1.md`                         | macOS only                                 | principle (constrains stack)           |
| `docs/decisions/0007-real-pty-login-shell.md`                  | Real PTY + login shell                     | principle (PTY registry)               |
| `docs/decisions/0010-session-restore-layout-chrome-not-cwd.md` | Session chrome without CWD                 | principle (session schema)             |
| `docs/decisions/0012-multi-window-workspace-model.md`          | Multi-window product model                 | product (drives coordinator + session) |
| `docs/adr/0001-session-restore-without-cwd.md`                 | Pre-pipeline session-chrome                | history; absorbed by ADR 0010          |
| `docs/adr/0002-last-tab-close-quits-app.md`                    | Pre-pipeline single-window quit            | history; replaced by ADR 0003          |

Rationale lives in the ADRs; this document records the chosen shape only.

## 12. Completeness check

Against PRINCIPLES: agent-CLI first, macOS, mouse+keyboard, real PTY, local-by-default, MIT, session-chrome-not-CWD — all reflected in seams and persistence.

Against PRD / BUSINESS-FLOW journeys: Open board → materialize → picker; restore-all + picker; swap; move-across-window; sidebar; presets; agent attention signal → status mark → acknowledge — each has a data flow and owning layer.

Against brownfield: shipped modules named; net-new called out; session-chrome-without-CWD (ADR 0010) preserved. Some net-new modules (Rust coordinator, tab-materialize / layout-engine / close-coordinator seams) are actively landing in the codebase; this document tracks the decisions, not a code snapshot — see `CONTEXT.md` for current implementation state.
