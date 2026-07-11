// Hero background — ghost terminal tokens drifting upward behind the stage,
// like scrollback seen through glass. Picked over five other motion trials;
// the elimination history lives in NOTES.md.

const STREAM_TOKENS = [
  "spawn pty/04",
  "attach tty7",
  "cwd ~/dev/glow",
  "diff --stat",
  "merge ⌥W",
  "resize 132×43",
  "SIGWINCH",
  "▮ 142ms",
  "scrollback 4096",
  "focus pane:01",
  "layout 65/35",
  "session restore",
  "stdout → pane",
  "▮ idle",
  "checkpoint ok",
  "pty read 8kb",
];

function createRng(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Each batch of tokens appears with its own entrance style, at loose
// positions — no columns, no shared rhythm. Batches are phase-shifted so
// a few are alive at any moment.
const BATCH_STYLES = ["type", "rise", "flicker", "focus"];

// Anchor slots spread evenly through the zones the opaque stage panel
// doesn't cover (left column, top band, bottom band); jitter keeps the
// field organic without letting batches pile onto each other.
const BATCH_SLOTS = [
  { x: 5, y: 10 },
  { x: 21, y: 12 },
  { x: 14, y: 24 },
  { x: 4, y: 38 },
  { x: 22, y: 33 },
  { x: 13, y: 52 },
  { x: 5, y: 66 },
  { x: 20, y: 58 },
  { x: 28, y: 72 },
  { x: 12, y: 3 },
  { x: 30, y: 4 },
  { x: 48, y: 3 },
  { x: 58, y: 5 },
  { x: 68, y: 4 },
  { x: 80, y: 5 },
  { x: 8, y: 84 },
  { x: 24, y: 86 },
  { x: 40, y: 84 },
  { x: 56, y: 86 },
  { x: 14, y: 91 },
  { x: 32, y: 92 },
  { x: 48, y: 91 },
];

function streamMarkup() {
  // Fresh seed per visit — every load gets its own field. The layout maths
  // stays deterministic per seed so a single render never self-mismatches.
  const rng = createRng(Math.floor(Math.random() * 4294967296));
  const batches = [];

  for (let batchIndex = 0; batchIndex < BATCH_SLOTS.length; batchIndex += 1) {
    const style = BATCH_STYLES[batchIndex % BATCH_STYLES.length];
    const slot = BATCH_SLOTS[batchIndex];
    const anchor = {
      x: slot.x + (rng() - 0.5) * 4,
      y: slot.y + (rng() - 0.5) * 4,
    };
    const tokenCount = 4 + Math.floor(rng() * 2);
    const cycle = 14 + rng() * 8;
    const delay = -(rng() * cycle);
    const tokens = [];

    for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex += 1) {
      const token = STREAM_TOKENS[Math.floor(rng() * STREAM_TOKENS.length)];
      const accent = rng() < 0.18;
      const offsetX = (rng() - 0.3) * 12;
      const offsetY = tokenIndex * 2.1 + (rng() - 0.5) * 1.2;

      tokens.push(`
        <span
          class="a-batch__token${accent ? " is-accent" : ""}"
          style="left: ${(anchor.x + offsetX).toFixed(1)}%; top: ${(anchor.y + offsetY).toFixed(1)}%; --a-token-i: ${tokenIndex};"
        >${token}</span>
      `);
    }

    batches.push(`
      <div
        class="a-batch a-batch--${style}"
        style="--a-batch-cycle: ${cycle.toFixed(1)}s; --a-batch-delay: ${delay.toFixed(1)}s;"
      >${tokens.join("")}</div>
    `);
  }

  return batches.join("");
}

export function mountHeroMotion(layer) {
  if (!layer) {
    return () => {};
  }

  layer.innerHTML = streamMarkup();

  return () => {
    layer.replaceChildren();
  };
}
