---
derived: true
derived_from: [0006, 0013, 0014, 0015, 0016, 0017, 0026]
rendered: 2026-07-10
---

# UX-DESIGN — Stackgrid

Interaction and visual design for the v1 **net-new** surfaces, distilled from a
clickable prototype reviewed by eye. Complements `PRD.md` (intent/journey/scope) and
`BUSINESS-FLOW.md` (states/rules/invariants); every surface here maps back to those
rules. Shipped surfaces (focus, split, drag-dock rearrange, pane zoom, busy/agent
chrome, tab bar, settings slide-over) are **referenced, not redefined** — this document
covers only what v1 adds. **Pane swap and cross-window move are net-new** (PRD
Brownfield note; ARCHITECTURE §2) and are defined in §6.

Rule references like `BF-Rule 14` / `BF-Inv 6` point at `BUSINESS-FLOW.md`.

## 1. Design language

The whole app reads as **one flat system**. Depth comes from background steps and 1px
hairlines, never drop shadows. Native macOS "skins" (vibrancy / Xcode / unified toolbar)
were prototyped and **rejected** in favour of keeping the shipped flat identity.

- **Tokens** (unchanged from shipped `styles.css`): `--bg`, `--fg`, `--accent`
  (Tokyo Night blue, **not** macOS system blue), chrome steps `--chrome-1/2`, hairlines
  `--hair` / `--hair-strong`, text `--text-primary/muted/faint`. UI font SF Pro, mono
  SF Mono.
- **Panes are borderless and edge-to-edge.** No per-pane corner radius; adjacent panes
  are separated by a **1px divider line** (`--hair`). Hovering a divider brightens it to
  accent (the resize affordance) with a widened invisible hit area (±3px) so a 1px line
  is easy to grab. The **active pane** is marked by a 1px inset accent frame — no radius,
  no gap. This is the iTerm/tmux idiom and replaces the earlier rounded, gapped panes.
- **Spacing.** Chrome stays compact; **panels and lists inside surfaces breathe** —
  section titles ~11px tracked caps, list rows ~40px tall with generous inset, primary
  titles 16px. Overlays and side panels keep a 12–14px radius (they float above the flat
  pane grid, so they read as distinct material).
- **Motion, with restraint.** Overlays rise + fade in (~0.2s, ease-out cubic); the
  sidebar slides in from the right; toasts rise from the bottom. Divider hover and button
  states are quick (~0.13s). No decorative motion.

Both **mouse and keyboard are first-class** on every surface (BF-Inv 9 / PRINCIPLES).
Each surface below lists both paths explicitly.

---

## 2. Open board

The pre-work chooser: pick a **workspace folder** and a **layout preset**, then
materialize a real tab. Shown on New Window, on launch with restore off / no session, or
an empty session (BF-Rule 1–5). It is a modal surface filling the window's stage.

### Layout

Two parallel columns of equal width under a header; a footer spans the bottom.

```
┌───────────────────────────────────────────────────────────┐
│ ◆ New window                                                │  header: logo + title + one-line sub
│   Pick a workspace folder and a layout — then open a tab.   │
├───────────────────────────────┬───────────────────────────┤
│ WORKSPACE        recent folders│ LAYOUT PRESET     split+CWD│  column titles (tracked caps)
│  ▸ monorepo         2h ago     │ ┌────────┐  ┌────────┐     │
│    ~/work/monorepo             │ │  ▭     │  │ ▭▭ ▭▭  │     │  preset cards w/ split-tree thumbnails
│  ▸ stackgrid     yesterday     │ │ single │  │ quad   │     │
│  ▸ infra-prod       3d ago     │ └────────┘  └────────┘     │
│  ▸ sandbox        last week    │ ┌────────┐  ┌────────┐     │
│                                │ │ focus+2│  │ 3 cols │     │
│  ＋ Open Folder…               │ └────────┘  └────────┘     │
├───────────────────────────────┴───────────────────────────┤
│ Open monorepo as Single pane      [Cancel]  [ Open ]        │  live summary + actions
└───────────────────────────────────────────────────────────┘
```

- **Workspace (left):** Cursor-style recents — each row shows folder name, dimmed
  mono path, and a relative "last opened" time. An **Open Folder…** affordance (dashed)
  sits below the list to pick any folder via the native dialog. "Workspace" means a
  **folder**, never a window/tab/session (BF-Inv 8).
- **Layout preset (right):** a 2-column grid of preset cards. Each card renders a
  **miniature of its split tree** (from the preset's serialized layout), the name, and a
  meta line (pane count · whether it carries a CWD map). The **built-in "Single pane"**
  preset is always present and tagged `BUILT-IN` so Open can never soft-lock (BF-Rule 4).
  A dashed **＋ New preset…** card at the end of the grid opens the preset editor (§3).
- **Preset card CRUD (BF-Rule 17):** saved cards manage themselves in place —
  right-click a card for **Rename…** / **Delete**; with a card focused, `R` renames
  inline and `⌫` deletes (one-step inline confirm on the card). The `BUILT-IN` card
  offers neither. Overwrite happens from a live layout (§3), not on the board.
- **Footer:** a live summary sentence ("Open **{workspace}** as **{preset}**"), plus
  **Cancel** and a primary **Open**.

### States

| State                     | Trigger / meaning                                                     |
| ------------------------- | --------------------------------------------------------------------- |
| No workspace chosen       | Summary shows "Select a workspace folder" (amber); **Open disabled**. |
| Workspace + preset chosen | Summary resolves; Open enabled.                                       |
| Empty recents             | Only "Open Folder…" is offered; preset column still usable.           |
| No saved presets          | Built-in Single pane is the sole card and is preselected (BF-Rule 4). |

**Preset default (decision):** preselect the **last-used preset** if one exists,
otherwise the built-in Single pane. Workspace defaults to the most-recent folder but is
always explicitly overridable.

### Interactions

- **Mouse:** click a recent to select; click **Open Folder…** for the native picker;
  click a preset card to select; click **Open** (or double-click a preset card as an
  Open shortcut). Click **Cancel** / press `Esc` to dismiss.
- **Keyboard:** `↑`/`↓` move within the focused column; `Tab` / `←`/`→` moves focus
  between the Workspace and Preset columns; `Return` = Open (when valid); `Esc` = Cancel.
  `⌘O` opens the native folder picker.

### CWD resolution on Open (BF-Rule 6)

Materializing applies the preset's split tree; each pane's CWD = **preset pane CWD if
set, else the chosen workspace folder** (the default CWD). One tab/layout is created in
that window (BF-Rule 4). Immediately after, each pane enters the **agent picker** (§4).

### Edge cases

- A recent whose folder no longer exists → row shows a subtle "missing" affordance and
  is non-selectable (or offers to remove it); it never blocks Open of a valid choice.
- Choosing Open Folder… that resolves to an already-recent folder just selects the
  existing recent (no duplicate row).

---

## 3. Preset editor (mini layout mock)

A modal for **designing a layout preset** without touching the live PTY layout
(BF state: _Preset editing_). Confirming **opens a new tab** with that layout — it does
**not** apply over the current tab (BF-Rule 18). It is also reachable from a live layout
via "save as preset" (BF-Rule 17, 19) — that path skips the mock.

**Entry points.** The **＋ New preset…** card on the Open board (§2), or
**Window ▸ New Layout Preset…** from a live window. Confirm behaves per BF-Rule 18 on
both paths: **Create tab** saves the named preset and opens a **new tab** with that
layout. `↑ inherit` panes resolve at that moment: to the board's chosen workspace when
entered from the board (BF-Rule 6 — Create tab is gated on a workspace selection like
Open, materializes the window's first tab, and dismisses the board), or to the focused
pane's CWD when entered from a live window (a mock-created tab is a runtime new tab —
BF-Rule 8).

**Save from a live layout (BF-Rule 17, 19).** **Window ▸ Save Layout as Preset…**
(`⌘⇧S`) captures the current tab without opening the mock: a small dialog asks for a
**name** (save as new) or an **existing preset to overwrite**, plus an
**Include per-pane folders** toggle (on by default — writes each pane's current CWD
into the preset's CWD map; off saves the bare tree). Rename and delete live on the
Open board's preset cards (§2).

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ▦ New layout preset   [Split right][Split down][Remove][Set CWD]│  toolbar acts on the selected pane
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┬──────────────┐                                │
│ │ ● ~/work     │ ● ↑ inherit  │   mock split-tree:             │
│ │   pane 1  ◀sel│   pane 2     │   - no per-pane radius         │
│ ├──────────────┼──────────────┤   - 1px divider lines          │
│ │ ● ↑ inherit  │ ● ↑ inherit  │   - drag a line to set ratio   │
│ │   pane 3     │   pane 4     │   - selected pane = inset accent│
│ └──────────────┴──────────────┘                                │
├──────────────────────────────────────────────────────────────┤
│ [ Quad grid          ]  4 panes · drag dividers   [Cancel][Create tab]│
└──────────────────────────────────────────────────────────────┘
```

The mock uses the **same pane language as the real render** — borderless, edge-to-edge,
1px divider lines, selected pane = inset accent frame — inside a subtly rounded outer
frame so it reads as a contained artifact. It mirrors `src/lib/split-tree.ts` (immutable
`leaf`/`split{dir,ratio,a,b}`); every edit returns a new tree.

Each mock pane header shows its **CWD**: an explicit path if set, or `↑ inherit`
(= will resolve to the workspace default at Open time, BF-Rule 6).

### Interactions

- **Select a pane:** click it (accent inset frame marks selection).
- **Split:** toolbar **Split right** (row) / **Split down** (column) splits the selected
  pane 50/50, adding a new `↑ inherit` pane (mirrors `splitLeaf`).
- **Remove:** removes the selected pane; its parent split collapses into the sibling
  (mirrors `removeLeaf`). Disabled at one pane.
- **Resize:** **drag any divider line** to set that split's ratio (mirrors `setRatio`);
  the line brightens while hovered/dragged, ratio is committed to the tree on release
  (clamped ~0.15–0.85).
- **Set CWD:** assigns an explicit CWD to the selected pane (or clears it back to
  inherit). Optional per BF-Rule 16 (v1 minimum = tree + CWD map).
- **Name + confirm:** name the preset; **Create tab** confirms → a **new tab** opens with
  this layout (BF-Rule 18). **Cancel** / `Esc` discards.

- **Keyboard:** arrow keys move the selection between panes; `⌘→`/`⌘↓` split the selected
  pane right/down; `⌫` removes it; `[`/`]` (or `⌥`+arrows) nudge the selected split's
  ratio; `Return` = Create tab; `Esc` = Cancel. The name field is a plain text input.

### Edge cases

- Removing down to a single pane disables Remove and yields a Single-pane preset.
- A preset with no explicit CWDs is valid — every pane inherits the workspace at Open.
- The mock never spawns a PTY; it only produces the artifact (split tree + optional CWD
  map) that a later Open materializes.

---

## 4. Agent picker

After a layout materializes (Open) **or** after session restore, every pane shows a
**one-shot** picker to run an agent or stay a shell (BF state: _Agent-pick pending_;
BF-Rule 10–14, BF-Inv 6). Restore never skips it (BF-Inv 6).

### Layout

A per-pane overlay dims that pane and centers a small card; a single global bar at the
top of the stage offers **Skip all**.

```
        ┌──────────────────────────────────────┐
        │ Agent picker · one-shot   [Skip all →]│   global bar (top of stage)
        └──────────────────────────────────────┘
   ┌───────────────────────┐   ┌───────────────────────┐
   │ Run an agent          │   │ Run an agent          │   one card per pending pane
   │ Detected on $PATH ·   │   │ Detected on $PATH ·   │
   │ pick spawns immediately│  │ pick spawns immediately│
   │  1  C  Claude Code  claude│  1  C  Claude Code  claude
   │  2  ◇  Codex        codex │  2  ◇  Codex        codex
   │  3  ✦  Gemini CLI   gemini│  3  ✦  Gemini CLI   gemini
   │  ───────────────────── │   │ ───────────────────── │
   │  0  ❯  Shell only  $SHELL│  0  ❯  Shell only  $SHELL
   └───────────────────────┘   └───────────────────────┘
```

- Options = **agent CLIs detected on `$PATH`** + a separated **Shell only** (BF-Rule 10);
  no mandatory user configuration in v1. Each option shows an icon, human name, and the
  actual command (mono).
- Each option carries a **number hint** (decision, keyboard-first per PRINCIPLES):
  `1..n` for agents, `0` for Shell only.

### Behaviour (BF-Rule 11–14)

- **Pick an agent** → spawns that command **immediately** in the pane; the card
  disappears, the pane badge/dot update to the running agent. The picker is **one-shot**
  per pane for this materialization — it does not re-prompt.
- **Shell only** → leaves an idle login shell.
- **Skip all** → every pane still pending becomes Shell; panes already chosen **keep
  their spawn** (BF-Rule 13). The global bar and all remaining cards clear.

### Interactions

- **Mouse:** click an option in any pane; click **Skip all** in the global bar.
- **Keyboard:** the focused pane's picker responds to its number keys (`1..n`, `0`);
  `↑`/`↓` + `Return` also selects; `⌘Return` / `⌥S` = Skip all. Focus follows the normal
  pane-focus model, so a keyboard user can tab through panes and pick each.

### Edge cases

- **No agents on `$PATH`** → the card shows only **Shell only** (plus a hint that no agent
  CLIs were found); Skip all still resolves everything to Shell.
- Panes materialized as Shell by Skip all are ordinary idle shells; they do not re-prompt
  until a new Open/restore cycle (BF-Rule 14).
- Restored panes spawn at `$HOME` (BF-Rule 7) before the picker resolves.

---

## 5. File sidebar (viewer)

**Cmd/Ctrl-click a filepath** in pane output to inspect it in a **read-only** right
sidebar: content preview + git diff. Never mutates the file (BF-Inv 5). Targets the
**focused (source) pane's** path context (BF-Rule 27–31).

### Path resolution (BF-Rule 28–29)

- Relative paths resolve against the **source pane's CWD**; absolute paths are used as-is.
- **Missing / unresolvable path → a toast, and the sidebar does NOT open** (BF-Rule 29).
- Existing path → the sidebar opens (BF-Rule 30).

### Layout & states

```
┌──────────────────────────────┐
│ ◆ auth.ts        READ-ONLY  ×│   header: file name + read-only chip + close
│ ~/work/monorepo/…/mw/auth.ts │   resolved path (mono, dimmed)
│ [ Preview ] [ Diff +12 −3 ]  │   segmented tabs (Diff shown only w/ git)
├──────────────────────────────┤
│  # rendered markdown, or      │   body (read-only)
│  syntax-tinted code, or       │
│  +/- git diff lines           │
└──────────────────────────────┘
```

| Sidebar state (BF) | Body                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| **Open (preview)** | File content. Markdown is **rendered** for `.md`; other files show tinted read-only source. |
| **Open (diff)**    | Git diff for the file (added/removed/context lines), shown only when git context exists.    |
| **Blocked**        | Path missing → toast (`Path not found — <path>`); sidebar stays closed.                     |

- The **Diff** tab is present **only when the file is in a git working tree** (BF-Rule 30);
  otherwise it is disabled/hidden and only Preview is available.
- A persistent **READ-ONLY** chip and the absence of any edit/save affordance make
  BF-Inv 5 legible; there is no way to write back to disk in v1.

**Default tab when git context exists (decision):** open on **Preview** (content-first);
Diff is one click away.

### Interactions

- **Open:** `⌘`-click (or `Ctrl`-click) a highlighted path in pane output. Plain click on
  a path does nothing destructive (a subtle highlight pulse hints the modifier).
- **Switch view:** click **Preview** / **Diff** tabs, or `⌘1` / `⌘2` while the sidebar is
  focused.
- **Close:** the header `×`, `Esc`, or the tab-bar sidebar toggle.
- **Scroll:** standard; the sidebar has its own scroll region independent of the panes.

### Edge cases

- Path exists but is binary/unreadable → Preview shows a "can't preview" placeholder;
  Diff still works if git-tracked.
- Path exists but not git-tracked → Preview only (no Diff tab).
- Re-inspecting a different path replaces the sidebar content in place (single sidebar).

---

## 6. Pane movement — swap & move across windows

Both surfaces are **net-new in v1** (PRD Brownfield note; ARCHITECTURE §2). They act on
live panes: neither ever touches the PTY — pane-ids are stable and the registry lives in
Rust (ARCHITECTURE §4) — and neither shows a busy confirm (BF-Rule 22, BF-Inv 3).

### Pane swap (BF-Rule 20)

Exchange two panes' places in the same tab; PTYs, scrollback, and running processes
follow their panes. A pure tree transform (exchange two leaf ids — ARCHITECTURE D2);
divider ratios stay as they are.

- **Mouse — center drop zone.** Pane drag (shipped drag-dock: grab the header bar)
  gains a fifth drop zone: the **inner region** of a target pane (roughly the middle
  half; the four edge zones keep the shipped dock behavior). Hovering it shows a
  **full-pane** accent overlay instead of a half-pane one; dropping **swaps** source
  and target. `Esc` still cancels the drag.
- **Keyboard — swap with neighbor.** `⌘⌥⇧` + `←`/`→`/`↑`/`↓` swaps the focused pane
  with its neighbor in that direction — the same neighbor resolution as directional
  focus (`⌘⌥` + arrows, shipped). Focus follows the pane to its new slot. No neighbor
  in that direction → no-op.

### Move a pane to another window (BF-Rule 21)

One affordance covers both directions of the round trip (detach for attention, later
join back into a layout — PRD "Steer"): a **"Move pane to…" popover** on the focused
pane, listing every legal destination.

```
┌ Move pane to… ─────────────────────────┐
│ ↗ New window                            │
│ ──────────────────────────────────────  │
│ ⧉ Window 2 · new tab                    │
│ ⧉ Window 2 · join "build" (active tab)  │
│ ⧉ Window 3 · new tab                    │
│ ⧉ Window 3 · join "infra" (active tab)  │
└─────────────────────────────────────────┘
```

- **Open it:** `⌘⇧M`, or **Window ▸ Move Pane To…** in the native menu bar. The menu
  item is the mouse path; the popover itself is fully clickable.
- **Destinations:** **New window** (pane becomes the sole pane of a fresh window's
  first tab); per other window, **new tab** (pane arrives as its own tab) or **join
  active tab** (pane splits onto that tab's focused pane, 50/50 — refine placement
  afterwards with shipped drag-dock). Rows name the target window by its active tab.
- **Keyboard:** `↑`/`↓` + `Return` selects; `Esc` cancels. **Mouse:** click a row.
- **Semantics (ARCHITECTURE D1):** one coordinator command reassigns ownership; the
  PTY keeps running; both webviews re-render. No busy confirm.

Edge cases:

- The source side collapses by the shipped close routing **without** the busy guard —
  nothing is killed: last pane leaves a tab → the tab closes (BF-Rule 24); the last
  tab leaves a window → that window closes (BF-Rule 25). The app never quits from a
  move — the pane's destination window always exists.
- **New window** is disabled when the pane is already the sole pane of its window's
  only tab (a no-op churn).
- Single window, single pane → the popover opens with all rows disabled and a hint
  ("nothing to move to — split first").

---

## 7. Cross-surface rules & seam notes

- **One-shot discipline:** the agent picker is the only surface that auto-appears per
  materialization; it never re-prompts within a cycle (BF-Rule 14).
- **No destructive confirms here:** swap / cross-window move (§6) show no busy confirm
  (BF-Inv 3); only close keeps the busy guard (shipped, unchanged).
- **Session vs preset:** the Open board and preset editor operate on **preset artifacts**
  (split tree + optional CWD map), which are separate from `session.json` (chrome only —
  BF-Inv 2). The picker and sidebar operate on the **live PTY** panes (PTYs live in the
  Rust registry keyed by stable pane-id; the webview attaches by id). No surface here
  persists CWDs or process identity into session chrome.
- **Keyboard parity:** every action above has a keyboard path; nothing is mouse-only
  (BF-Inv 9 / PRINCIPLES).

## 8. Open decisions folded in (defaults — overridable)

1. **Open board preset default** → remember last-used preset, else built-in Single pane.
2. **Agent picker** → show per-option number hints for keyboard-first picking.
3. **Sidebar default tab (git files)** → Preview.
4. **Swap affordances** → center drop zone on the shipped pane drag + `⌘⌥⇧` arrows.
5. **Cross-window move** → single "Move pane to…" popover (`⌘⇧M` / Window menu).
6. **Preset CRUD placement** → rename/delete on Open board cards; save-from-live and
   new-preset entries in the Window menu (`⌘⇧S` / board card).

These were set as least-surprise defaults during prototype review (items 4–6 added
later, in the requirements phase); none are load-bearing for the architecture and each
can change without reshaping a surface.
