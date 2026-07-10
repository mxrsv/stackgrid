---
derived: true
derived_from: [0001, 0002, 0003, 0010, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0020, 0021, 0022, 0023]
rendered: 2026-07-10
version: 1
---

# REQUIREMENTS — Stackgrid

Atomic functional (FR) and non-functional (NFR) requirements for v1, distilled from the
active ADR set, rendered into the upstream docs: `PRINCIPLES.md`, `PRD.md`, `BUSINESS-FLOW.md`,
`ARCHITECTURE.md`, `UX-DESIGN.md`. This is the terminal artifact of the docs pipeline
and the input contract for planning — `superpowers:writing-plans` owns all FR→task
decomposition; this document plans nothing.

## Conventions

- `FR-xxx` / `NFR-xxx` are atomic and numbered. Each carries its own acceptance
  criteria (`AC-n`) — the AC line is the atomic unit of this contract.
- **Epic** (product area) and **story** (feature slice) are traceability labels only —
  never implementation units, never planning order.
- Refs point upstream: `PRD` sections, `BF-Rule n` / `BF-Inv n` (BUSINESS-FLOW),
  `ARCH Dn/§n` (ARCHITECTURE), `UX §n` (UX-DESIGN).
- **[shipped-keep]** asserts existing brownfield behavior that must not regress;
  everything unmarked is net-new v1 work.

## Epic index

| Epic | Label         | Scope                                     |
| ---- | ------------- | ----------------------------------------- |
| E1   | open-board    | Workspace ∥ preset chooser, Open flow     |
| E2   | presets       | Preset store, editor (mini mock), CRUD    |
| E3   | agent-picker  | PATH detect, one-shot pick / spawn        |
| E4   | pane-movement | Swap, move across windows                 |
| E5   | multi-window  | Coordinator, window lifecycle, quit       |
| E6   | session       | `session.json` v2, restore-all, migration |
| E7   | sidebar       | Cmd+click path → preview + diff           |
| E8   | foundation    | Cross-cutting behavioral guards           |

---

## E1 — open-board

### FR-001 — Open board trigger

The Open board is shown whenever a window has no layout to present.
Story: open-flow.

- AC-1: The New Window action opens a window showing the Open board, never an empty layout.
- AC-2: Cold launch with session restore disabled shows the Open board.
- AC-3: Cold launch with restore enabled but no (or empty) session data shows the Open board.
- AC-4: The restore path never routes through the Open board when valid session chrome exists (it materializes windows, then enters agent-pick — FR-052).

Refs: BF-Rule 1, 3 · BF-Inv 6 · PRD Journey · UX §2.

### FR-002 — Board composition

The board presents two parallel columns — Workspace (recent folders + Open Folder…) and
Layout preset (cards grid) — with a footer holding a live summary sentence, Cancel, and
a primary Open action. Story: open-flow.

- AC-1: Workspace rows show folder name, dimmed mono path, and relative last-opened time.
- AC-2: An Open Folder… affordance below the recents opens the native folder dialog.
- AC-3: Preset cards render a miniature of their split tree, the preset name, and a meta line (pane count · CWD-map presence).
- AC-4: The built-in preset card is always present and tagged `BUILT-IN` (FR-011) — the board can never soft-lock.
- AC-5: A dashed “＋ New preset…” card at the end of the grid opens the preset editor (FR-014).

Refs: BF-Rule 4, 5 · UX §2.

### FR-003 — Workspace recents behavior

Recents are selectable folder entries with safe edge handling. Story: open-flow.

- AC-1: Clicking a recent selects it as the workspace.
- AC-2: A recent whose folder no longer exists shows a “missing” affordance, is non-selectable, and never blocks Open of a valid choice.
- AC-3: Open Folder… resolving to an already-listed folder selects the existing row (no duplicate).
- AC-4: With no recents, only Open Folder… is offered; the preset column stays usable.

Refs: BF-Rule 5 · UX §2 (states + edge cases).

### FR-004 — Selection defaults and Open gating

Open requires a valid workspace + preset pair; defaults minimize friction. Story: open-flow.

- AC-1: Open is disabled while no workspace is chosen; the summary shows “Select a workspace folder” (amber).
- AC-2: The preset selection defaults to the last-used preset when one exists, else the built-in Single pane.
- AC-3: The workspace defaults to the most-recent folder but is always explicitly overridable.
- AC-4: With both chosen, the summary reads “Open {workspace} as {preset}” and Open is enabled.

Refs: BF-Rule 4 · UX §2 (states, decision 1).

### FR-005 — Open materializes one tab with resolved CWDs

Confirming Open creates exactly one tab/layout in that window from the chosen preset.
Story: open-flow.

- AC-1: The preset’s split tree materializes as the window’s tab; one PTY per leaf (FR-070).
- AC-2: Each pane’s CWD = the preset’s pane CWD when set, else the chosen workspace folder.
- AC-3: Immediately after materialization every pane enters agent-pick pending (FR-021).
- AC-4: Double-clicking a preset card acts as an Open shortcut (when a workspace is selected).

Refs: BF-Rule 4, 6 · ARCH §6 · UX §2.

### FR-006 — Board keyboard path

The board is fully keyboard-operable. Story: open-flow.

- AC-1: `↑`/`↓` move within the focused column; `Tab` / `←`/`→` switch between the two columns.
- AC-2: `Return` triggers Open when valid; `Esc` cancels/dismisses.
- AC-3: `⌘O` opens the native folder picker.

Refs: UX §2 (interactions) · NFR-003.

---

## E2 — presets

### FR-010 — Preset persistence artifact

Presets persist in `presets.json` (plugin-store), a separate artifact from
`session.json`. Story: store.

- AC-1: Schema v1: `{ version: 1, presets: [{ id, name, layout: SerializedNode, cwds?: (string | null)[] }] }`.
- AC-2: `cwds` zips leaves left-to-right, matching the serialized-tree leaf order (ARCH §10).
- AC-3: `presets.json` never contains live session or window-set data; `session.json` never contains preset data.
- AC-4: A preset with no explicit CWDs is valid — every pane inherits the workspace at Open time.

Refs: BF-Rule 15, 16 · BF-Inv 2 · ARCH D4.

### FR-011 — Built-in default preset

A code-defined single-pane preset (no CWD map) is always available. Story: store.

- AC-1: The built-in preset appears on the Open board even when `presets.json` is empty or missing.
- AC-2: It offers no rename, delete, or overwrite affordance.
- AC-3: With no saved presets it is the sole card and is preselected.

Refs: BF-Rule 4 · ARCH D4 · UX §2.

### FR-012 — Save current layout as preset

From a live window, the current tab’s layout can be captured as a named preset without
opening the mock. Story: save-from-live.

- AC-1: Window ▸ Save Layout as Preset… (`⌘⇧S`) opens a small dialog: name (save as new) or pick an existing preset to overwrite.
- AC-2: An “Include per-pane folders” toggle (default on) writes each pane’s current CWD into the preset’s CWD map; off saves the bare tree.
- AC-3: Saving persists to `presets.json` and survives restart.

Refs: BF-Rule 17, 19 · UX §3.

### FR-013 — Preset rename / delete on the board

Saved preset cards manage themselves in place on the Open board. Story: board-crud.

- AC-1: Right-click a saved card → Rename… / Delete.
- AC-2: With a card focused, `R` renames inline and `⌫` deletes with a one-step inline confirm on the card.
- AC-3: The `BUILT-IN` card offers neither (FR-011 AC-2).

Refs: BF-Rule 17 · UX §2.

### FR-014 — Preset editor (mini layout mock)

A modal editor designs a preset’s split tree without touching the live PTY layout.
Story: editor.

- AC-1: Entry points: the “＋ New preset…” board card, and Window ▸ New Layout Preset… from a live window.
- AC-2: Toolbar acts on the selected pane: Split right / Split down (50/50, new pane defaults to `↑ inherit`), Remove (parent split collapses into sibling; disabled at one pane), Set CWD (assign explicit path or clear back to inherit).
- AC-3: Dragging a divider line sets that split’s ratio (committed on release, clamped ~0.15–0.85).
- AC-4: Each mock pane header shows its CWD: explicit path, or `↑ inherit`.
- AC-5: The mock never spawns a PTY; it only produces the artifact (split tree + optional CWD map).
- AC-6: The mock mirrors the immutable split-tree model (`leaf` / `split{dir, ratio, a, b}`); every edit returns a new tree.

Refs: BF-Rule 16, 18 · ARCH §10 · UX §3.

### FR-015 — Create tab from the editor

Confirming the editor saves the named preset and opens a new tab — never replacing the
current tab in place. Story: editor.

- AC-1: Create tab persists the named preset and opens a new tab with that layout.
- AC-2: Entered from the Open board: Create tab is gated on a workspace selection (like Open), materializes the window’s first tab, and dismisses the board; `↑ inherit` panes resolve to the board’s chosen workspace.
- AC-3: Entered from a live window: the new tab is a runtime tab; `↑ inherit` panes resolve to the focused pane’s CWD.
- AC-4: The current tab’s layout is never mutated by a Create-tab confirm.
- AC-5: Panes of the created tab enter agent-pick pending (FR-021).

Refs: BF-Rule 6, 8, 18 · UX §3.

### FR-016 — Editor keyboard path

The preset editor is fully keyboard-operable. Story: editor.

- AC-1: Arrow keys move pane selection; `⌘→`/`⌘↓` split right/down; `⌫` removes.
- AC-2: `[`/`]` (or `⌥`+arrows) nudge the selected split’s ratio.
- AC-3: `Return` = Create tab; `Esc` = Cancel.

Refs: UX §3 (interactions) · NFR-003.

---

## E3 — agent-picker

### FR-020 — Agent detection

A Rust command `detect_agents` resolves a hardcoded allowlist against `PATH`.
Story: detect.

- AC-1: Allowlist v1 = `claude`, `codex`, `gemini` (aligned with shipped chrome recognition; extensible in code without settings UI).
- AC-2: Returns `[{ name, path }]` for binaries actually found on `PATH`.
- AC-3: No heuristic full-PATH scan; no user-configurable list in v1 (PRD Later).

Refs: BF-Rule 10 · BF-Inv 4 · ARCH D6.

### FR-021 — One-shot picker lifecycle

After a layout materializes (Open / Create tab) or after session restore, every pane
shows a one-shot agent picker. Story: pick.

- AC-1: Each pending pane shows a per-pane overlay card; a single global bar offers Skip all.
- AC-2: The picker is one-shot per pane per materialization: once resolved (pick / Shell / Skip all), it never re-prompts until a new Open/restore cycle.
- AC-3: Session restore never skips the picker.
- AC-4: Options = detected agents (FR-020) + a separated Shell only entry, each showing icon, human name, and the actual command (mono).

Refs: BF-Rule 10, 14 · BF-Inv 6 · UX §4.

### FR-022 — Pick spawns immediately

Choosing an agent runs it in that pane at once. Story: pick.

- AC-1: The chosen command spawns immediately in the pane’s shell; the card disappears.
- AC-2: The pane’s badge/dot chrome updates to the running agent (shipped process-name styling).

Refs: BF-Rule 11 · ARCH D6 · UX §4.

### FR-023 — Shell only

Choosing Shell resolves the pane without spawning anything. Story: pick.

- AC-1: The pane remains an idle login shell at its resolved CWD; the card disappears.

Refs: BF-Rule 12 · UX §4.

### FR-024 — Skip all

The global bar resolves every still-pending pane at once. Story: skip.

- AC-1: Every pane still pending becomes Shell; panes already resolved keep their spawn.
- AC-2: The global bar and all remaining cards clear.

Refs: BF-Rule 13 · UX §4.

### FR-025 — No agents detected

The picker degrades gracefully when `PATH` yields nothing. Story: detect.

- AC-1: The card shows only Shell only plus a hint that no agent CLIs were found.
- AC-2: Skip all still resolves everything to Shell.

Refs: UX §4 (edge cases).

### FR-026 — Picker keyboard path

The picker is keyboard-first. Story: pick.

- AC-1: Number hints: `1..n` for agents, `0` for Shell only; the focused pane’s picker responds to them.
- AC-2: `↑`/`↓` + `Return` also selects; `⌘Return` / `⌥S` = Skip all.
- AC-3: Focus follows the normal pane-focus model, so a keyboard user can move through panes and pick each.

Refs: UX §4 (interactions, decision 2) · NFR-003.

---

## E4 — pane-movement

### FR-030 — Swap semantics

Swap exchanges two panes’ places in the same tab; sessions follow their panes.
Story: swap.

- AC-1: Swap is a pure tree transform exchanging two leaf ids; the PTY registry is untouched.
- AC-2: PTYs, scrollback, and running processes follow their panes to the new slots.
- AC-3: Divider ratios stay as they are.
- AC-4: No busy confirmation is ever shown for a swap.

Refs: BF-Rule 20, 22 · BF-Inv 3 · ARCH D2, §4 · UX §6.

### FR-031 — Swap by mouse (center drop zone)

The shipped pane drag gains a fifth drop zone that swaps. Story: swap.

- AC-1: The inner region (roughly the middle half) of a target pane is a swap drop zone; the four edge zones keep the shipped dock behavior.
- AC-2: Hovering the center zone shows a full-pane accent overlay (vs the half-pane dock overlay).
- AC-3: Dropping swaps source and target; `Esc` cancels the drag.

Refs: UX §6 (decision 4).

### FR-032 — Swap by keyboard

Directional swap mirrors directional focus. Story: swap.

- AC-1: `⌘⌥⇧` + `←`/`→`/`↑`/`↓` swaps the focused pane with its neighbor in that direction, using the same neighbor resolution as shipped directional focus.
- AC-2: Focus follows the pane to its new slot.
- AC-3: No neighbor in that direction → no-op.

Refs: UX §6 · NFR-003.

### FR-033 — “Move pane to…” popover

One affordance lists every legal destination for the focused pane. Story: move.

- AC-1: Opened by `⌘⇧M` or Window ▸ Move Pane To… (native menu).
- AC-2: Destinations: New window; and per other window — new tab, or join active tab (pane splits onto that tab’s focused pane 50/50).
- AC-3: Rows name the target window by its active tab.
- AC-4: `↑`/`↓` + `Return` selects; `Esc` cancels; rows are clickable.

Refs: BF-Rule 21 · UX §6 (decision 5).

### FR-034 — Move semantics (ownership reassignment)

Moving a pane across windows reassigns ownership without touching the process.
Story: move.

- AC-1: One coordinator command reassigns `pane_id → window` ownership; the PTY keeps running.
- AC-2: Source webview removes the pane from its tree (no kill); destination webview inserts it and attaches xterm to the existing PTY.
- AC-3: `pty:output` / `pty:exit` route to the destination window after the move.
- AC-4: No busy confirmation is ever shown for a move.
- AC-5: Moves are bidirectional — a detached pane can be joined back into another window/tab.

Refs: BF-Rule 21, 22 · BF-Inv 3 · ARCH D1, §6.

### FR-035 — Source-side collapse after a move

The vacated slot collapses by the shipped close routing, without the busy guard.
Story: move.

- AC-1: Nothing is killed by the collapse: last pane leaving a tab closes the tab; the last tab leaving a window closes that window.
- AC-2: The app never quits as a result of a move — the destination window always exists.

Refs: BF-Rule 24, 25 · UX §6 (edge cases).

### FR-036 — Move popover disabled states

Illegal destinations are visible but inert. Story: move.

- AC-1: New window is disabled when the pane is already the sole pane of its window’s only tab.
- AC-2: Single window + single pane → the popover opens with all rows disabled and a hint (“nothing to move to — split first”).

Refs: UX §6 (edge cases).

---

## E5 — multi-window

### FR-040 — Rust coordinator with targeted PTY events

An app-level Rust coordinator owns pane→window routing. Story: coordinator.

- AC-1: Rust maintains an ownership map `pane_id → window` alongside the existing PTY registry.
- AC-2: `pty:output` / `pty:exit` are emitted only to the owning window, never broadcast to all webviews.
- AC-3: Pane-id remains ≡ PTY id (`spawn_shell` return value) — the leaf id in the split tree and the xterm routing key.

Refs: ARCH D1, D2, §4, §7 · ADR decisions/0001.

### FR-041 — Window close kills only owned PTYs

Closing a window affects only what it still owns. Story: coordinator.

- AC-1: Closing a window kills only PTYs still owned by that window; panes moved away earlier are unaffected.
- AC-2: Close paths (pane / tab / window) keep the busy guard: confirmation when any affected pane is busy.
- AC-3: Other windows are unaffected by one window closing.

Refs: BF-Rule 23, 25 · ARCH D1 · FR-071.

### FR-042 — Quit semantics

The app quits exactly when no windows remain (or on explicit Quit). Story: quit.

- AC-1: Closing the last tab of a window closes that window; the app keeps running if other windows remain.
- AC-2: The app quits when the last window/tab of the whole app is gone; explicit Quit (⌘Q / close on last window) reaches the same end state.
- AC-3: The busy guard still applies on quit paths.

Refs: BF-Rule 25, 26 · BF-Inv 7 · ARCH D8 · ADR decisions/0003.

### FR-043 — Cross-window store reload

Shared persisted artifacts stay consistent across webviews. Story: coordinator.

- AC-1: A writer of `settings.json` / `presets.json` emits an app-wide event (`settings-changed` / `presets-changed`).
- AC-2: Other windows reload the artifact on that event (e.g. the Open board’s preset grid reflects a preset saved in another window).

Refs: ARCH D7, §9.

---

## E6 — session

### FR-050 — `session.json` v2 schema (chrome only)

Session persistence covers all windows and stays chrome-only. Story: schema.

- AC-1: Schema v2: `{ version: 2, windows: [{ id, tabs: [{ layout, name?, dotColor? }], activeTab }], focusedWindowId? }`.
- AC-2: The file never contains CWDs, PTY ids, process identity, or scrollback.
- AC-3: Serialized layouts strip pane ids (structure + ratios only).

Refs: BF-Inv 2 · ARCH D3, §8, §10 · ADR decisions/0002 · PRINCIPLES.

### FR-051 — v1 → v2 session migration

Existing single-window sessions survive the upgrade. Story: schema.

- AC-1: A v1 flat session (`{ version: 1, tabs, activeTab }`) loads as a single-window v2 session on first launch after the upgrade.
- AC-2: Migration loses no tab chrome (layouts, names, colors, active tab).

Refs: ARCH D3.

### FR-052 — Restore-all windows

Cold launch with restore on rebuilds every window’s chrome. Story: restore-all.

- AC-1: One window is created per `windows[]` entry; each materializes its tab trees with fresh shells.
- AC-2: Restored panes spawn at `$HOME` — CWDs are never restored from session data.
- AC-3: Every restored pane enters agent-pick pending (FR-021).
- AC-4: Running processes are never restored.

Refs: BF-Rule 2, 7 · BF-Inv 2 · ARCH D3, §6 · PRD Journey (Resume).

### FR-053 — Debounced aggregate session save

Chrome changes anywhere persist as one artifact. Story: schema.

- AC-1: Chrome mutations (tabs, splits, names, colors, window set, active/focused state) trigger a debounced save.
- AC-2: The save aggregates chrome from all windows into a single `session.json` write.

Refs: ARCH D3, D7.

### FR-054 — Closed-tab reopen keeps in-memory CWDs [shipped-keep]

The in-session closed-tab stack continues to restore CWDs from memory only.
Story: restore-all.

- AC-1: Reopening a closed tab within the same app run may restore its pane CWDs from the in-memory stack (max 10), as shipped.
- AC-2: This never writes CWDs to disk.

Refs: BF-Rule 9 · PRINCIPLES · ARCH §2, §8.

---

## E7 — sidebar

### FR-060 — Cmd+click opens the file inspector flow

A modifier-click on a filepath token in pane output starts path inspection.
Story: resolve.

- AC-1: `⌘`-click (or `Ctrl`-click) on a detected filepath token in a pane’s output triggers resolution against that source pane.
- AC-2: A plain click on a path does nothing destructive; a subtle highlight pulse hints the modifier.

Refs: BF-Rule 27 · UX §5.

### FR-061 — Path resolution

Paths resolve deterministically against the source pane. Story: resolve.

- AC-1: Relative paths resolve against the source pane’s current CWD (from `pty_info`).
- AC-2: Absolute paths are used as-is.

Refs: BF-Rule 28 · ARCH D5.

### FR-062 — Missing path blocks the sidebar

Nonexistent paths never open UI. Story: resolve.

- AC-1: If the resolved path does not exist, a toast appears (`Path not found — <path>`).
- AC-2: The sidebar does not open (and stays closed if it was closed).

Refs: BF-Rule 29 · UX §5.

### FR-063 — Content preview

An existing path opens the right sidebar in Preview. Story: preview.

- AC-1: Rust `read_file_preview` performs the existence check and a capped UTF-8 read; the frontend only renders.
- AC-2: `.md` files render as Markdown; other text files show tinted read-only source.
- AC-3: Binary/unreadable files show a “can’t preview” placeholder (Diff still works when git-tracked).
- AC-4: The header shows file name and resolved path (mono, dimmed).

Refs: BF-Rule 30 · ARCH D5 · UX §5.

### FR-064 — Git diff view

A Diff tab appears only when git context exists. Story: diff.

- AC-1: Rust `git_diff` shells out (`git -C <cwd> diff -- <path>`) — same trust model as the shipped `git_branch`.
- AC-2: The Diff tab is present only when the file is inside a git working tree; otherwise only Preview is available.
- AC-3: The default tab is Preview even when git context exists; Diff is one click away.
- AC-4: An untracked-but-existing file shows Preview only.

Refs: BF-Rule 30 · ARCH D5 · UX §5 (decision 3).

### FR-065 — Read-only guarantee

The sidebar can never mutate the file it shows. Story: preview.

- AC-1: No edit or save affordance exists anywhere in the sidebar; there is no write-back path to disk in v1.
- AC-2: A persistent READ-ONLY chip is visible in the header.

Refs: BF-Rule 31 · BF-Inv 5 · UX §5.

### FR-066 — Sidebar chrome behavior

One sidebar instance per window, replaceable in place. Story: preview.

- AC-1: Inspecting a different path replaces the sidebar content in place (single sidebar).
- AC-2: Close via the header `×`, `Esc`, or the tab-bar sidebar toggle.
- AC-3: `⌘1` / `⌘2` switch Preview / Diff while the sidebar is focused; tabs are clickable.
- AC-4: The sidebar scrolls independently of the panes.

Refs: UX §5 (interactions) · NFR-003.

---

## E8 — foundation

### FR-070 — Real PTY everywhere [shipped-keep]

Every pane created by any v1 surface is backed by exactly one real PTY. Story: guards.

- AC-1: Panes created via Open, preset Create tab, restore, split, or move are backed by a real PTY spawning `$SHELL -l` (or equivalent).
- AC-2: No surface introduces a fake/half terminal that breaks PATH, aliases, or dotfiles.

Refs: BF-Inv 1 · PRINCIPLES · ARCH §1.

### FR-071 — Busy-guard scope

Busy confirmation exists only on destructive close paths. Story: guards.

- AC-1: Close pane / close tab / close window / quit confirm when any affected pane is busy.
- AC-2: Swap, cross-window move, and detach never show a busy confirmation.

Refs: BF-Rule 22, 23 · BF-Inv 3.

---

## NFR

### NFR-001 — macOS only

v1 commits to macOS only; no Windows/Linux support is implied by any requirement.

- AC-1: No FR is implemented in a way that commits the product to another OS.

Refs: PRINCIPLES · BF-Rule 33.

### NFR-002 — Local by default, no telemetry

Terminal contents, session, settings, and preset data stay on device.

- AC-1: The app performs no telemetry and no network calls with terminal/session/preset data unless the user explicitly sends data somewhere.
- AC-2: All v1 persistence targets local files (`settings.json`, `session.json`, `presets.json`).

Refs: PRINCIPLES · BF-Rule 32 · BF-Inv 4.

### NFR-003 — Mouse and keyboard both first-class

Every net-new surface has a complete path for both input modes.

- AC-1: Each of E1–E7’s interactive surfaces satisfies its keyboard-path FR (FR-006, FR-016, FR-026, FR-032, FR-033 AC-4, FR-066) and its mouse interactions.
- AC-2: No v1 action is mouse-only or keyboard-only.

Refs: PRINCIPLES · BF-Inv 9 · UX §7.

### NFR-004 — Unsigned distribution accepted, friction documented

v1 may ship unsigned; the Gatekeeper first-run friction is documented for users.

- AC-1: Signing/notarization is not a v1 ship gate.
- AC-2: The README (or equivalent user-facing doc) documents the Gatekeeper first-run steps.

Refs: PRD Scope · BF-Rule 34.

### NFR-005 — MIT / open source

The project remains MIT-licensed; v1 introduces no dependency incompatible with that.

- AC-1: LICENSE stays MIT; new dependencies are license-compatible.

Refs: PRINCIPLES.

### NFR-006 — Design-language conformance

Net-new surfaces read as the shipped flat system.

- AC-1: Depth via background steps and 1px hairlines only — no drop shadows; panes stay borderless and edge-to-edge with 1px dividers; active pane = 1px inset accent frame.
- AC-2: New surfaces use the shipped tokens (`--bg`, `--fg`, `--accent`, `--chrome-1/2`, `--hair`, text tokens); UI font SF Pro, mono SF Mono.
- AC-3: Motion stays restrained: overlays rise + fade (~0.2s ease-out), sidebar slides from the right, toasts rise from the bottom; no decorative motion.

Refs: UX §1.

### NFR-007 — Rendering architecture constraints

The hybrid pattern holds at multi-window scale.

- AC-1: Terminal rendering stays imperative xterm.js outside Preact’s tree.
- AC-2: PTY traffic never flows through signals — Rust events → owning webview → terminal layer.
- AC-3: UI signals stay per-webview; shared state crosses windows only via persisted stores + reload events (FR-043).

Refs: ARCH §1, D7.

### NFR-008 — No regression of shipped surfaces

The v1 gap work must not degrade the shipped foundation.

- AC-1: Focus (cycle + directional), split, drag-dock rearrange, divider resize, focus-expand, zoom, tab bar, settings, themes, Cmd+F search, file-drop → PTY, git branch in status bar, agent/busy chrome, and busy/quit guards keep working as shipped.
- AC-2: Session chrome restore semantics remain layout-chrome-only (ADR 0010 stays in force).

Refs: PRD Brownfield note · ARCH §2, §11.

### NFR-009 — Terminology discipline

Product language keeps the three concepts distinct.

- AC-1: UI copy and docs use workspace = folder, window = OS window, session = persisted chrome — never interchangeably.

Refs: BF-Rule 5 · BF-Inv 8.

---

## Coverage — upstream cross-check

### BUSINESS-FLOW rules → requirements

| BF-Rule | Covered by                           |
| ------- | ------------------------------------ |
| 1       | FR-001                               |
| 2       | FR-052                               |
| 3       | FR-001                               |
| 4       | FR-002, FR-004, FR-005, FR-011       |
| 5       | FR-002, FR-003, NFR-009              |
| 6       | FR-005, FR-015                       |
| 7       | FR-052                               |
| 8       | FR-015 (+ shipped inherit — NFR-008) |
| 9       | FR-054                               |
| 10      | FR-020, FR-021, FR-025               |
| 11      | FR-022                               |
| 12      | FR-023                               |
| 13      | FR-024                               |
| 14      | FR-021                               |
| 15      | FR-010                               |
| 16      | FR-010, FR-014                       |
| 17      | FR-012, FR-013                       |
| 18      | FR-014, FR-015                       |
| 19      | FR-012                               |
| 20      | FR-030                               |
| 21      | FR-033, FR-034                       |
| 22      | FR-030, FR-034, FR-071               |
| 23      | FR-041, FR-071                       |
| 24      | FR-035 (+ shipped routing — NFR-008) |
| 25      | FR-035, FR-041, FR-042               |
| 26      | FR-042                               |
| 27      | FR-060                               |
| 28      | FR-061                               |
| 29      | FR-062                               |
| 30      | FR-063, FR-064                       |
| 31      | FR-065                               |
| 32      | NFR-002                              |
| 33      | NFR-001                              |
| 34      | NFR-004                              |

### BUSINESS-FLOW invariants → requirements

| BF-Inv | Covered by                                   |
| ------ | -------------------------------------------- |
| 1      | FR-070                                       |
| 2      | FR-050, FR-010 AC-3                          |
| 3      | FR-030, FR-034, FR-071                       |
| 4      | FR-020, NFR-002 (+ shipped chrome — NFR-008) |
| 5      | FR-065                                       |
| 6      | FR-001 AC-4, FR-021 AC-3                     |
| 7      | FR-042                                       |
| 8      | NFR-009                                      |
| 9      | NFR-003                                      |

### PRD journeys → requirements

| Journey                                        | Covered by                           |
| ---------------------------------------------- | ------------------------------------ |
| Happy path (Open board → materialize → picker) | FR-001…FR-006, FR-005, FR-020…FR-026 |
| Resume (restore-all + picker)                  | FR-050…FR-053, FR-021                |
| Steer (swap, move/join, quit rule)             | FR-030…FR-036, FR-040…FR-042         |
| Inspect (Cmd+click → sidebar)                  | FR-060…FR-066                        |
| Capture (presets, mock → new tab)              | FR-010…FR-016                        |

### ARCHITECTURE decisions → requirements

D1 → FR-034, FR-040, FR-041 · D2 → FR-030, FR-040 AC-3 · D3 → FR-050…FR-053 ·
D4 → FR-010, FR-011 · D5 → FR-061, FR-063, FR-064 · D6 → FR-020, FR-022 ·
D7 → FR-043, FR-053, NFR-007 · D8 → FR-042.

---

## Handoff note

- This contract is the terminal artifact of the docs pipeline; `version: 1` (v2 ADR-derived render — same v1 requirements, now traced to the active ADR set).
- REQUIREMENTS renders from the active ADR set (frontmatter `derived_from`) — the handoff to `superpowers:writing-plans` carries no staleness warnings.
- UX-DESIGN §8 defaults (last-used preset preselect, picker number hints, sidebar Preview default, swap affordances, move popover, CRUD placement) are folded into the FRs above as stated defaults; none are load-bearing for the architecture and each can change without reshaping a surface.
