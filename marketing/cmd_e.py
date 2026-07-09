"""Stackgrid — Cmd+E (focusExpand) explainer.

Faithful to source:
  EXPAND_RATIO = 0.65  (focused pane gets >=65% on each split along its path)
  Tokyo Night palette; agent dot colors from process-info.ts.

Render:
  manim -qh --disable_caching cmd_e.py CmdE      # 1080p60 master
  manim -ql --disable_caching cmd_e.py CmdE      # fast draft
"""

from manim import *

# ---- palette (from src/styles.css) --------------------------------------
BG        = "#0d0d14"   # scene backdrop (a touch darker than window)
WIN_BG    = "#16161e"   # --bg
PANE_BG   = "#1a1b26"
FG        = "#c0caf5"   # --fg
ACCENT    = "#7aa2f7"   # --accent (active pane border)
DIM       = "#2f3145"
BAR_DIM   = "#3b3f58"
RED       = "#f7768e"
YELLOW    = "#e0af68"
GREEN     = "#9ece6a"   # codex dot
MAGENTA   = "#bb9af7"   # claude dot
CYAN      = "#7dcfff"   # gemini dot
MONO      = "Menlo"

EXPAND = 0.65  # EXPAND_RATIO

# ---- content box (inside the window chrome) -----------------------------
CW, CH   = 11.9, 5.5
CX0      = -CW / 2
CY_TOP   = 2.42
GAP      = 0.16


def pane_rect(fx, fy, fw, fh):
    """Fractional rect within content (fy from top) -> (cx, cy, w, h)."""
    x_left = CX0 + fx * CW + GAP / 2
    y_top  = CY_TOP - fy * CH - GAP / 2
    w = fw * CW - GAP
    h = fh * CH - GAP
    return x_left + w / 2, y_top - h / 2, w, h


def layout(L, T):
    """L = left column share, T = top share of the right column."""
    return {
        "A": pane_rect(0, 0, L, 1),          # claude  (left)
        "B": pane_rect(L, 0, 1 - L, T),      # codex   (right-top)
        "C": pane_rect(L, T, 1 - L, 1 - T),  # gemini  (right-bottom)
    }


EQUAL   = layout(0.5, 0.5)
FOCUS_A = layout(EXPAND, 0.5)          # claude big
FOCUS_B = layout(1 - EXPAND, EXPAND)   # codex big
FOCUS_C = layout(1 - EXPAND, 1 - EXPAND)  # gemini big

AGENTS = {
    "A": ("claude", MAGENTA),
    "B": ("codex", GREEN),
    "C": ("gemini", CYAN),
}


def make_pane(rect, name, dot, active):
    cx, cy, w, h = rect
    frame = RoundedRectangle(
        width=w, height=h, corner_radius=0.10,
        fill_color=PANE_BG, fill_opacity=1.0,
        stroke_color=ACCENT if active else DIM,
        stroke_width=3.6 if active else 1.4,
    ).move_to([cx, cy, 0])

    pad = 0.20
    left = frame.get_left()[0]
    top = frame.get_top()[1]

    dotc = Dot(radius=0.058, color=dot).move_to([left + pad + 0.058, top - pad - 0.058, 0])
    label = Text(name, font=MONO, font_size=17, color=FG)
    label.next_to(dotc, RIGHT, buff=0.12).set_y(dotc.get_y())
    header = VGroup(dotc, label)

    inner_w = w - 2 * pad
    bars = VGroup()
    for i, wf in enumerate((0.72, 0.5, 0.62)):
        bw = inner_w * wf
        bar = RoundedRectangle(
            width=bw, height=0.058, corner_radius=0.029,
            fill_color=(ACCENT if (active and i == 0) else BAR_DIM),
            fill_opacity=1.0, stroke_width=0,
        )
        bar.move_to([left + pad + bw / 2, top - pad - 0.058 - 0.44 - i * 0.26, 0])
        bars.add(bar)

    return VGroup(frame, header, bars)


class CmdE(Scene):
    def construct(self):
        self.camera.background_color = BG

        # ---- window chrome -------------------------------------------------
        win = RoundedRectangle(
            width=12.3, height=6.5, corner_radius=0.22,
            fill_color=WIN_BG, fill_opacity=1.0,
            stroke_color="#2a2a38", stroke_width=1.6,
        ).move_to([0, -0.15, 0])
        titlebar = Line(
            win.get_corner(UL) + [0.0, -0.52, 0.0],
            win.get_corner(UR) + [0.0, -0.52, 0.0],
            stroke_color="#2a2a38", stroke_width=1.2,
        )
        lights = VGroup(*[Dot(radius=0.075, color=c) for c in (RED, YELLOW, GREEN)])
        lights.arrange(RIGHT, buff=0.14)
        lights.move_to(win.get_corner(UL) + [0.5, -0.26, 0.0])
        tabname = Text("stackgrid", font=MONO, font_size=16, color="#565f89")
        tabname.move_to(win.get_top() + [0.0, -0.26, 0.0])
        chrome = VGroup(win, titlebar, lights, tabname)

        caption = Text("", font=MONO, font_size=22, color=FG).move_to([0, -3.55, 0])

        def say(txt, color=FG, t=0.5):
            new = Text(txt, font=MONO, font_size=22, color=color).move_to([0, -3.55, 0])
            self.play(Transform(caption, new), run_time=t)

        # ---- Scene 1 : setup ----------------------------------------------
        self.play(FadeIn(chrome, shift=UP * 0.15), run_time=0.7)
        panes = {k: make_pane(EQUAL[k], *AGENTS[k], active=(k == "A")) for k in "ABC"}
        self.play(
            *[FadeIn(panes[k], scale=0.96) for k in "ABC"],
            run_time=0.7,
        )
        self.add(caption)
        say("three agents · every pane fights for space", color="#9aa5ce")
        self.wait(0.9)

        # ---- Scene 2 : Cmd+E press ----------------------------------------
        key = RoundedRectangle(
            width=1.7, height=1.0, corner_radius=0.16,
            fill_color="#24283b", fill_opacity=1.0,
            stroke_color=ACCENT, stroke_width=2.2,
        )
        ktext = Text("⌘ E", font=MONO, font_size=34, color=FG)
        keycap = VGroup(key, ktext).move_to([0, -0.15, 0])
        self.play(FadeIn(keycap, scale=1.3), run_time=0.35)
        self.play(keycap.animate.scale(0.9), run_time=0.12)
        self.play(keycap.animate.scale(1.0 / 0.9), run_time=0.12)

        target = {k: make_pane(FOCUS_A[k], *AGENTS[k], active=(k == "A")) for k in "ABC"}
        self.play(
            keycap.animate.scale(0.4).set_opacity(0.0).shift(DOWN * 0.3),
            *[Transform(panes[k], target[k]) for k in "ABC"],
            run_time=1.1,
            rate_func=smooth,
        )
        self.remove(keycap)

        # 65% callout on the expanded pane
        cx, cy, w, h = FOCUS_A["A"]
        badge = VGroup(
            RoundedRectangle(width=1.35, height=0.6, corner_radius=0.14,
                             fill_color=ACCENT, fill_opacity=0.16,
                             stroke_color=ACCENT, stroke_width=1.6),
            Text("65%", font=MONO, font_size=24, color=ACCENT),
        ).move_to([cx + w / 2 - 0.95, cy + h / 2 - 0.5, 0])
        self.play(FadeIn(badge, scale=0.8), run_time=0.4)
        say("⌘E · focusExpand — active pane takes 65%", color=ACCENT)
        self.wait(1.0)
        self.play(FadeOut(badge), run_time=0.3)

        # ---- Scene 3 : spotlight follows focus ----------------------------
        say("the spotlight follows your focus", color="#9aa5ce")

        def focus(state, active_key, t=1.0):
            tgt = {k: make_pane(state[k], *AGENTS[k], active=(k == active_key)) for k in "ABC"}
            self.play(*[Transform(panes[k], tgt[k]) for k in "ABC"],
                      run_time=t, rate_func=smooth)

        focus(FOCUS_B, "B")   # codex grows
        self.wait(0.7)
        focus(FOCUS_C, "C")   # gemini grows
        self.wait(0.7)
        focus(FOCUS_A, "A")   # back to claude
        self.wait(0.6)

        # ---- Scene 4 : payoff ---------------------------------------------
        self.play(
            *[panes[k].animate.set_opacity(0.18) for k in "ABC"],
            FadeOut(caption),
            chrome.animate.set_opacity(0.25),
            run_time=0.7,
        )
        word = Text("stackgrid", font=MONO, font_size=58, color=FG, weight=BOLD)
        tag = Text("many agents · one focus", font=MONO, font_size=26, color="#9aa5ce")
        cta = VGroup(
            RoundedRectangle(width=2.9, height=0.72, corner_radius=0.16,
                             fill_color=ACCENT, fill_opacity=0.14,
                             stroke_color=ACCENT, stroke_width=1.8),
            Text("⌘E to expand", font=MONO, font_size=22, color=ACCENT),
        )
        group = VGroup(word, tag, cta).arrange(DOWN, buff=0.35).move_to([0, 0, 0])
        self.play(Write(word), run_time=0.7)
        self.play(FadeIn(tag, shift=UP * 0.1), run_time=0.5)
        self.play(FadeIn(cta, scale=0.9), run_time=0.5)
        self.wait(1.4)
