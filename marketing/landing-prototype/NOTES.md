# Hero motion trials — direction A (PROTOTYPE)

**Question:** what moving-background treatment does the direction A hero get?
Multi-round elimination — nothing is decided until a variant survives review.

Flip via the MOTION row in the switcher (visible only on direction A), keys `0–5`,
or `?motion=` in the URL. Base URL: `/?lang=en`.

> Historical log. The switcher, the losing variants and the `/landing-prototype/`
> route are all gone — see the verdict at the bottom. The landing is served at `/`.

## Round 1 candidates (2026-07-11)

| #   | key       | Concept                                                                   |
| --- | --------- | ------------------------------------------------------------------------- |
| 0   | `off`     | Baseline — static background as shipped in the direction pick.            |
| 1   | `sweep`   | Survey beam crossing the field, lighting the crosshair grid as it passes. |
| 2   | `plotter` | Hairlines + register marks drawing themselves in slow plotter cycles.     |
| 3   | `signal`  | Grid intersections blinking sparsely, like agent activity on a map.       |
| 4   | `drift`   | Ambient phosphor glow drifting + scanlines breathing. Pure atmosphere.    |
| 5   | `stream`  | Ghost terminal tokens scrolling vertically, like scrollback behind glass. |

Round 1 self-review notes:

- `sweep` — strongest single read; beam + grid highlight sync is clean.
- `plotter` — paths placed in the empty zones (top band, left column, bottom band)
  because the stage panel is opaque; ink/accent raised once already.
- `signal` — sparse by design; judged live, not by still frame. 64 dots, seeded PRNG.
- `drift` — intentionally the quietest; glow intensity raised once already.
- `stream` — most present; column near the copy might read as noise, judge live.

## Round 2 (2026-07-11) — `stream` leads

User picked `stream` as the favourite. Adjustments applied:

- Static plus-grid (`.direction-a::before`) is disabled while stream is active —
  two overlapping patterns read as noise. Gated via `data-hero-motion` on the
  section so other variants keep the grid.
- Token legibility raised: ink 9% → 17%, accent 22% → 36%.

## Round 3 (2026-07-11) — `stream` rebuilt as scatter batches

User asked for unordered text with per-batch entrance styles (columns felt too
regular). Rebuilt: 10 phase-shifted batches of 3–4 tokens at loose anchors,
cycling through four entrance styles — `type` (clip-path steps, terminal
typing), `rise` (fade-up), `flicker` (CRT stutter), `focus` (blur-in).
Anchors biased to the stage-free zones (left column / top band / bottom band)
because the stage panel is opaque; life duty raised to ~48% of each cycle so
the field never reads dead.

## Round 4 (2026-07-11) — upward drift + density

User asked for upward motion and a denser field. Applied:

- Every batch drifts upward for its whole cycle (translateY 2.75rem →
  -2.75rem on the batch container, ~5px/s); the loop seam lands in the dark
  half of the cycle so the jump never shows.
- Density up: 14 batches (was 10), 4–5 tokens each (was 3–4).
- Random zone anchors replaced with evenly spread slots (6 left column,
  4 top band, 4 bottom band) + jitter — random placement was piling
  batches onto each other and leaving dead frames.

## Round 5 (2026-07-11) — more slots, sharper tokens

- Slots 14 → 22 (left column 8, top band 6, bottom band 8 across two rows).
- Legibility up another notch: ink 17% → 24%, accent 36% → 48%.
- One slot (x15/y80) drifted into the "View on GitHub" row and read as
  garbage text — moved to the empty pocket between the CTA block and the
  switcher (x28/y72).

## Round 6 (2026-07-11) — copy backdrop removed in stream mode

The copy block's gradient backdrop (`.a-copy::before`) was masking the token
field behind the headline. Disabled while stream is active (same
`data-hero-motion` gate as the grid) — the 97%-white display type holds its
own directly on the 24% tokens.

## Round 7 (2026-07-11) — stage pulled off the copy

With the backdrop gone the stage's left edge sat under the headline. In
stream mode the stage narrows (88% → 74% of its grid area, desktop only) so
panel and copy never touch — verified on both EN and VI headlines.

Note: the token field is deterministic on purpose (seeded PRNG, same layout
every reload) so review rounds stay comparable. Swap the seed for
`Date.now()` when finalizing if a fresh field per visit is wanted.

## Verdict (2026-07-12) — `stream` ships

`stream` picked after seven tuning rounds: it's the only candidate that says
"live terminal work" instead of decorating the grid, and rounds 3–7 fixed the
legibility/composition issues that made it risky. Promotion cleanup applied:

- Deleted losing variants (`sweep`/`plotter`/`signal`/`drift` code + CSS) and
  directions B–E (`src/directions/{b,c,d,e}.js`, `styles/direction-{b,c,d,e}.css`).
- Deleted the review switcher and its state module; digit keys `0–5` and
  arrow-key direction cycling are gone with it.
- EN/VI became a real language toggle in the topbar (collapses to a lone
  toggle on mobile, where the rail already carries the brand).
- PRNG seed swapped from the fixed review seed to a random seed per visit —
  the field layout is still deterministic within a single render.
