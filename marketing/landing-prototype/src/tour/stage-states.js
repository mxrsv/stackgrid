/**
 * Tour stage data — English-only, mirroring the released app just like the
 * hero stage (see the 2026-07-23 scroll-tour spec). Sidebar data is shared
 * with the hero via product-stage.js.
 */

import { deepFreeze } from "../product-stage.js";

/** Agent identity chips reused across board rows and pane chrome. */
export const AGENTS = deepFreeze({
  claude: { monogram: "C", name: "claude", tint: "#bb9af7" },
  codex: { monogram: "X", name: "codex", tint: "#9ece6a" },
  gemini: { monogram: "G", name: "gemini", tint: "#7dcfff" },
});

/** Open board recent rows — the top one carries the remembered combo. */
export const boardRecents = deepFreeze([
  {
    id: "stackgrid",
    label: "stackgrid",
    path: "…rkspace/stackgrid",
    highlighted: true,
    preset: "trio",
    agents: ["claude", "codex", "gemini"],
  },
  {
    id: "glowarena",
    label: "glowarena",
    path: "…rkspace/glowarena",
    highlighted: false,
    preset: "duo",
    agents: ["claude"],
  },
  {
    id: "glow-api",
    label: "glow-api",
    path: "…rkspace/glow-api",
    highlighted: false,
    preset: "quad",
    agents: ["codex"],
  },
]);

/** Cells per preset thumbnail; layout itself lives in tour.css. */
export const PRESET_CELLS = deepFreeze({ duo: 2, trio: 3, quad: 4 });

/**
 * Static transcripts for chapters 2–3. The mock renders these frozen (plus a
 * blinking cursor); the live typing engine is a post-review follow-up.
 */
export const tourPanes = deepFreeze([
  {
    id: "claude",
    focused: true,
    prompt: "❯",
    lines: [
      {
        text: "● I'll trace why the pane divider drifts on resize.",
        cls: "t-body",
      },
      { text: "● Read(src/terminal/layout-engine.ts)", cls: "t-tool" },
      { text: "  ⎿ 312 lines", cls: "t-dim" },
      { text: "● Update(src/terminal/layout-engine.ts)", cls: "t-tool" },
      {
        text: "  ⎿ +14 -6 · keep the fractional ratio in the tree",
        cls: "t-dim",
      },
      {
        text: "● 214 tests passed — the divider stays put now.",
        cls: "t-ok",
      },
    ],
  },
  {
    id: "codex",
    focused: false,
    prompt: "▌",
    lines: [
      { text: "› trace the flicker when a pane closes", cls: "t-user" },
      { text: "The old pane's canvas paints one frame late.", cls: "t-body" },
      { text: "✓ Applied patch src/terminal/pane-lifecycle.ts", cls: "t-ok" },
      { text: "  └ requestAnimationFrame before detach", cls: "t-dim" },
    ],
  },
  {
    id: "gemini",
    focused: false,
    prompt: ">",
    lines: [
      {
        text: "> why does the status bar lose the branch after cd?",
        cls: "t-user",
      },
      { text: "The watcher only re-reads HEAD on focus.", cls: "t-body" },
      { text: "edit src/lib/git-status.ts", cls: "t-tool" },
      { text: "  + watch cwd from osc-7 events", cls: "t-dim" },
      { text: "✓ typecheck clean · branch follows cwd now", cls: "t-ok" },
    ],
  },
]);
