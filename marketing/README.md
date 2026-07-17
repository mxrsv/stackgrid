# Stackgrid — marketing assets

Animated explainer for **Cmd+E (`focusExpand`)**: the focused pane grows to
**65%** of its splits (`EXPAND_RATIO`) while the other agents stay in view, and
the spotlight follows focus as you switch panes.

Rendered with [Manim](https://www.manim.community/) — source: [`cmd_e.py`](./cmd_e.py).
Landscape 16:9. All clips end on a short fade so they loop cleanly.

## Web assets (`public/`)

The landing prototype is served by Vite with root `marketing/`. Files under
[`public/`](./public/) are copied to URL `/` at dev and build time — **do not**
put README-only or master assets there.

| Public path | Source (canonical) | Notes |
| ----------- | ------------------ | ----- |
| `/stackgrid-cmd-e-poster.png` | `marketing/stackgrid-cmd-e-poster.png` | `<video poster>` |
| `/stackgrid-cmd-e.webm` | `marketing/stackgrid-cmd-e.webm` | Landing `<video>` (VP9) |
| `/stackgrid-cmd-e.mp4` | `marketing/stackgrid-cmd-e.mp4` | Landing `<video>` (H.264) |
| `/landing-prototype/assets/partner-mark.svg` | `landing-prototype/assets/partner-mark.svg` | Partner mark icon |
| `/landing-prototype/assets/stackgrid-icon.svg` | `landing-prototype/assets/stackgrid-icon.svg` | Product icon |

After re-rendering or editing icons, copy updated files into `public/` (same
relative paths). GIF and 1080p60 master stay out of `public/` — they are not
bundled for the landing build.

## README / master assets (repo root of `marketing/`)

| File                          | Use it for                     | Notes                                                        |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------ |
| `stackgrid-cmd-e.gif`         | **GitHub README** embed        | Autoplays & loops inline. 960px wide, 15fps. Not in `public/`. |
| `stackgrid-cmd-e.mp4`         | **Landing page** `<video>`     | H.264, `yuv420p`, `+faststart`. Copy to `public/` for web.   |
| `stackgrid-cmd-e.webm`        | **Landing page** `<video>`     | VP9 — comparable size; list first so modern browsers use it. |
| `stackgrid-cmd-e-poster.png`  | `<video poster>` / social card | First-paint frame before the video loads.                    |
| `stackgrid-cmd-e-1080p60.mp4` | Master (re-edits, uploads)     | Full-quality 1920×1080 @ 60fps, no fade. Not in `public/`.   |
| `cmd_e.py`                    | Re-render / edit the animation | Manim scene.                                                 |

## Embed in the GitHub README

```markdown
![Stackgrid — Cmd+E focus expand](marketing/stackgrid-cmd-e.gif)
```

Prefer sharper playback? Drag `stackgrid-cmd-e-1080p60.mp4` into a GitHub
comment/README on github.com — GitHub hosts it and renders a video player
(MP4 files referenced by path do **not** autoplay inline, which is why the GIF
exists).

## Embed on a landing page

```html
<video
  autoplay
  muted
  loop
  playsinline
  poster="/stackgrid-cmd-e-poster.png"
  style="width:100%;max-width:960px;border-radius:12px"
>
  <source src="/stackgrid-cmd-e.webm" type="video/webm" />
  <source src="/stackgrid-cmd-e.mp4" type="video/mp4" />
</video>
```

`muted` is required for `autoplay` to work in modern browsers. `playsinline`
stops iOS Safari from going fullscreen.

## Re-render

```bash
# one-time: pip install manim   (needs ffmpeg + cairo/pango on PATH)
manim -qh --disable_caching cmd_e.py CmdE   # 1080p60 master
manim -ql --disable_caching cmd_e.py CmdE   # fast draft
```

Palette, agent dot colors, and the 65% ratio are pulled straight from the app
source (`src/styles.css`, `src/lib/process-info.ts`, `src/terminal/terminal-manager.ts`)
so the explainer stays truthful to real behavior.
