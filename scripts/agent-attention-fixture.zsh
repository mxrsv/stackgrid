#!/bin/zsh
#
# agent-attention-fixture.zsh — DEV-ONLY manual acceptance fixture (Task 25A
# of the Agent Attention Rail plan).
#
# Deterministically impersonates an agent's terminal signals (OSC 9;4
# progress, OSC 9 / OSC 777 notifications, terminal bell) so a human can
# acceptance-test the Agent Attention Rail WITHOUT a real agent running.
#
# NOT imported, required, or packaged by the app in any way. It is a plain
# shell script meant to be launched manually from a terminal pane, and it is
# safe to run ONLY from the repo root (it does not read or write repo files,
# but the launcher command below assumes the pane's cwd is the repo root).
#
# --- Why kernel argv[0] must literally be "claude" ------------------------
#
# The app's pty_info poll (src/terminal/pane-info-poller.ts,
# DEFAULT_INTERVAL_MS = 2000) recognizes an agent by reading the foreground
# process's *kernel* argv[0] basename and matching it against an allowlist
# that includes "claude" (src-tauri/src/agents.rs, AGENT_ALLOWLIST). That is
# the real argv0 the OS reports for the process, not $0 inside this script —
# so this script cannot fake it by itself. It must be launched like this:
#
#   /bin/zsh -c 'exec -a claude /bin/zsh scripts/agent-attention-fixture.zsh all'
#
# Why this exact shape:
#   - The interactive pane shell starts `/bin/zsh -c '...'` as a foreground
#     job, so that outer zsh becomes the foreground process-group leader
#     for the pane (PID == PGID == TPGID).
#   - `exec -a claude /bin/zsh ...` REPLACES that outer zsh process IN PLACE
#     (same PID, same PGID) with a fresh /bin/zsh interpreter whose kernel
#     argv[0] is the string "claude", while it keeps running THIS script as
#     that interpreter. No new process/group is created, so it is still the
#     foreground group leader pty_info inspects.
#   - This script must NEVER tail-exec into Python, Node, or any other
#     interpreter/binary — an `exec` there would rewrite argv0 again (or, on
#     macOS, a framework-y launcher could re-exec itself) and defeat
#     recognition. Only zsh builtins and system tools already on macOS
#     (printf, sleep) are used below — no subprocess replaces this
#     interpreter after the `exec -a claude` above.
#
# --- Why event scenarios wait > 1 poll interval before their first event --
#
# AgentAttentionTracker only accepts activity/signal input for a pane AFTER
# a poll has recognised that pane's foreground process as an agent (the
# "process gate"), and never replays input that arrived before the gate
# opened. The poll runs every 2000ms, so every event scenario below sleeps
# 2.5s (POLL_GATE_WAIT, comfortably > one interval) before emitting anything,
# giving at least one recognized-agent poll time to land and open the gate.
#
# --- Usage ------------------------------------------------------------
#
#   agent-attention-fixture.zsh [probe|all|batch|split]   (default: all)
#
#   probe  - emits NO attention signal; just stays alive as the foreground
#            group leader so pty_info recognition can be verified in
#            isolation, before any event scenario runs.
#   all    - a realistic, human-watchable walk through every state:
#            working -> clear(completed) -> warning -> error -> requested.
#   batch  - working->error->clear emitted in a SINGLE write (no sleeps
#            between them) to exercise the ordered-batch parser: error must
#            still latch even though the final state in the batch is clear.
#   split  - one OSC 9;4 sequence whose terminator arrives in a second,
#            separate write after a tiny delay, to exercise the carry /
#            split-across-reads path.
#
# The app never treats this script's plain-text output as a semantic signal
# — only the raw OSC/bell bytes matter. The text lines below are purely for
# the human operator watching the pane.

set -u

SCENARIO="${1:-all}"

# --- Timing constants ---------------------------------------------------
POLL_GATE_WAIT=2.5   # > one 2000ms pty_info poll interval
STEP_PAUSE=2         # pause between observable transitions in "all"
SPLIT_DELAY=0.05     # gap between the two writes in "split"
IDLE_CHUNK=3600       # sleep granularity while holding the fg group alive

# --- Raw signal emitters (printf interprets \033 and \a for us) --------

# OSC 9;4 progress-report state: 0 clear, 1 working, 2 error, 4 warning.
progress() {
  printf '\033]9;4;%s\a' "$1"
}

# OSC 9 general notification (classified as "requested").
osc9_notify() {
  printf '\033]9;%s\a' "$1"
}

# OSC 777 notify form: ESC ] 777 ; notify ; <title> ; <body> BEL
osc777_notify() {
  printf '\033]777;notify;%s;%s\a' "$1" "$2"
}

bell() {
  printf '\a'
}

label() {
  printf '\n[fixture:%s] %s\n' "$SCENARIO" "$1"
}

# Hold this process (the foreground group leader) alive indefinitely so the
# app keeps polling/rendering the last state until the human kills it
# (Ctrl-C) or closes the pane.
hold_foreground() {
  label "sequence complete — holding foreground for inspection (Ctrl-C to stop)"
  while true; do
    sleep "$IDLE_CHUNK"
  done
}

wait_for_poll_gate() {
  label "waiting ${POLL_GATE_WAIT}s for the pty_info poll to recognize this pane as an agent (argv0=claude)..."
  sleep "$POLL_GATE_WAIT"
}

case "$SCENARIO" in
  probe)
    label "probe — kernel argv0 should be 'claude'; emitting NO attention signal"
    label "check pty_info / pane header now, BEFORE running any event scenario"
    hold_foreground
    ;;

  all)
    wait_for_poll_gate

    label "working — OSC 9;4;1"
    progress 1
    sleep "$STEP_PAUSE"

    label "clear (renders as completed) — OSC 9;4;0"
    progress 0
    sleep "$STEP_PAUSE"

    label "warning — OSC 9;4;4"
    progress 4
    sleep "$STEP_PAUSE"

    label "error — OSC 9;4;2"
    progress 2
    sleep "$STEP_PAUSE"

    label "requested — OSC 9 notification + bell"
    osc9_notify "fixture: attention requested"
    bell
    sleep "$STEP_PAUSE"

    hold_foreground
    ;;

  batch)
    wait_for_poll_gate

    label "batch — working->error->clear in ONE write, no sleeps between them"
    label "(error must latch even though the batch's final state is clear)"
    printf '\033]9;4;1\a\033]9;4;2\a\033]9;4;0\a'

    hold_foreground
    ;;

  split)
    wait_for_poll_gate

    label "split — OSC 9;4;1 terminator arrives in a second, separate write"
    printf '\033]9;4;1'
    sleep "$SPLIT_DELAY"
    printf '\a'

    hold_foreground
    ;;

  *)
    printf 'agent-attention-fixture.zsh: unknown scenario "%s" (expected probe|all|batch|split)\n' "$SCENARIO" >&2
    exit 1
    ;;
esac
