---
id: 0027
title: "Agent attention signals + per-pane acknowledge"
date: 2026-07-24
kind: product
affects: [PRD, BUSINESS-FLOW, ARCHITECTURE, UX-DESIGN, REQUIREMENTS]
supersedes: []
---

# ADR 0027 — Agent attention signals + per-pane acknowledge

## Context

The shipped contract is `TabView.agentBusy + unread`: a boolean "is the agent working" flag plus a single tab-level unread bit. Users running several agents in parallel (ADR 0011) need to know _which pane_ needs them right now — completed, warned, errored, or actively asking — not just which tab has any new output. The existing sidebar/tab bar is already the delivery surface for this; the gap is a richer, trustworthy per-pane signal on top of it.

## Decision

Two independent state axes per pane: `AgentPhase` (`unknown` / `idle` / `working` / `exited`) is the runtime work signal; `AttentionKind` (`none` / `completed` / `requested` / `warning` / `error`) is the latched, actionable state. They are separate axes — a pane can be `working` while still carrying a latched `warning` that has not been acknowledged.

**Source precedence.** Explicit signals — OSC 9;4 progress severity (states `2`/`4`), OSC 9 / OSC 777 notification, and the terminal bell — always outrank the sustained-output heuristic. The heuristic may only ever produce `working` → `idle` → `completed` (and only after an observed working streak); it must never produce `warning`, `error`, or `requested`. Stackgrid never parses rendered terminal text or model output to infer attention — no regex on strings like "Allow?", "Press Enter", or "Done". Every signal, explicit or heuristic, is gated behind the existing agent-recognition process poll: activity from a pane before its foreground process is confirmed to be an agent, or after it reverts to a shell, is ignored and never replayed once the gate reopens.

**Per-pane acknowledge.** Acknowledging is additive and distinct from the legacy tab-level unread clearing. Focusing a pane — by click, or via `Cmd+Shift+A` / status-mark navigation — clears that pane's own `attention` and its own per-pane `unread`. It does not clear `phase`: a pane still `working` keeps showing working after being acknowledged. This is independent of `TabView.unread`, which keeps its current meaning (background-tab-has-new-output) and is still cleared by the public `selectTab()` call; the two unread concepts run side by side and neither replaces the other.

**Notification policy.** Native OS notification is opt-in: default off, enabled only by an explicit Settings toggle, and a denied OS permission keeps the setting `false`. It fires only while the Stackgrid window is not focused — the in-app rail is the primary channel while the app is foregrounded. Each attention transition sends at most one notification (deduped by pane + revision). Notification copy is limited to the workspace label, a normalized agent/process label, and a fixed kind string ("finished" / "needs attention" / "warning" / "error") — never raw terminal content.

**Out of scope.** Agent-specific adapters or hooks for Claude Code, Codex, or Gemini CLI; distinguishing `needs_input` from `needs_approval` (v1 uses one generic `requested` / "needs attention" label until a structured per-agent signal exists); and any run history/ledger, token/cost telemetry, transcript, or replay of past attention. Attention state lives only in memory for the life of the PTY and is not persisted across restarts.

## Consequences

- PRD gains an "observe attention across panes" outcome alongside the existing steer/resume journeys; this stays an observe/steer aid, not an orchestration feature.
- BUSINESS-FLOW gains the signal → attention → acknowledge transitions and the invariant "acknowledge clears attention and per-pane unread, never phase"; legacy tab-level unread clearing on `selectTab()` is unchanged.
- ARCHITECTURE gains the `AgentAttentionTracker` as a pure per-pane state owner inside `TabManager`, fed by `pty:output` (OSC 9;4 + sustained-output fallback), `PaneEvents` (OSC 9/777 notification + bell), and `pty_info` (the agent-recognition process gate) — no new agent runtime or IDE surface is introduced.
- UX-DESIGN gains the shared status-mark precedence (`error > warning > requested > completed > working > unread > idle`), click/keyboard navigation (`Cmd+Shift+A`), and its accessibility contract.
- REQUIREMENTS gains testable FR/AC for phase vs. attention as separate axes, source precedence, per-pane acknowledge, navigation ordering, and notification opt-in/background-only/one-per-transition.
- `Busy` (the foreground-process guard used by the close flow) is unaffected by this ADR: `Agent phase` is a new, distinct runtime-work signal for the Attention Rail and does not redefine or replace `Busy`.

## Options rejected

- Parsing rendered terminal text or model output ("Allow?", "Press Enter", "Done") to infer attention — unreliable across agents and locales, and couples Stackgrid to CLI-specific UI copy; rejected in favor of protocol signals (OSC/bell) plus a conservative, capped output heuristic.
- Distinguishing `needs_input` vs `needs_approval` in v1 — no structured per-agent signal proves the distinction yet; a single `requested` label avoids claiming more certainty than the data supports. Deferred to a future agent-specific adapter.
- Persisting attention state as a run ledger/history in v1 — turns a live coordination aid into an audit system prematurely; deferred until the Attention Rail has real usage data.
- Reusing `Busy` or the legacy tab-level unread flag as the acknowledge mechanism for the new per-pane attention — would silently change close-guard and legacy-unread semantics that other flows already depend on; kept as two additive, independent axes instead.
- Enabling native notification by default or requesting OS permission at startup — spams users and trips the permission prompt before it is wanted; opt-in via Settings keeps it deliberate and background-only.
