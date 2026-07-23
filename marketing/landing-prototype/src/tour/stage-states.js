/**
 * Tour stage data — English-only, mirroring the released app just like the
 * hero stage. Pane transcripts and the workspace sidebar are shared with the
 * hero (product-stage.js); this module holds only tour-specific state.
 */

import { deepFreeze } from "../product-stage.js";

/** Agent identity chips on the Open board rows. */
export const AGENTS = deepFreeze({
  claude: { monogram: "C", tint: "#bb9af7" },
  codex: { monogram: "X", tint: "#9ece6a" },
  gemini: { monogram: "G", tint: "#7dcfff" },
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

/** Cells per preset thumbnail; the layouts themselves live in tour.css. */
export const PRESET_CELLS = deepFreeze({ duo: 2, trio: 3, quad: 4 });

/**
 * Sidebar avatar indicators, as in the released app: "busy" = spinning ring
 * (agent working on a prompt), "unread" = yellow dot (new output not seen).
 */
export const SIDEBAR_STATUS = deepFreeze({
  stackgrid: "busy",
  glowarena: "unread",
  "glow-api": "busy",
});

/**
 * Aurora palette per chapter — every stop comes from the app's own Tokyo
 * Night theme so each chapter reads distinct while staying on-brand:
 * ① calm blue (the app's UI accent, "ready") → ② the three agent brand
 * colors as agents launch → ③ hot magenta-into-violet around the focused
 * pane (the climax; deliberately away from the hero's ambient violet).
 */
export const AURORA_SCENES = deepFreeze({
  1: { colorStops: ["#3d59a1", "#7aa2f7", "#2a3f7e"], amplitude: 1.0 },
  2: { colorStops: ["#bb9af7", "#9ece6a", "#7dcfff"], amplitude: 1.15 },
  3: { colorStops: ["#f7768e", "#bb9af7", "#8d27e6"], amplitude: 1.25 },
});
