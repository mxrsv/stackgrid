import type { AgentAttentionSummary } from "../terminal/tabs-store";
import { WorkspaceSpinner } from "./workspace-spinner";

interface AgentAttentionMarkProps {
  /** Aggregated attention state for one tab/workspace. */
  summary: AgentAttentionSummary;
  /** Workspace/tab name — feeds the accessible name. */
  label: string;
  /** Invoked when an ACTIONABLE mark is clicked. */
  onActivate?: () => void;
}

/** Kinds whose count/color come from `summary.actionableCount`. */
type ActionableKind = "error" | "warning" | "requested" | "completed";

const ACTIONABLE_WORD: Record<ActionableKind, string> = {
  error: "error",
  warning: "warning",
  requested: "requested",
  completed: "completed",
};

function isActionableKind(
  kind: AgentAttentionSummary["kind"],
): kind is ActionableKind {
  return kind in ACTIONABLE_WORD;
}

function actionableAriaLabel(
  label: string,
  kind: ActionableKind,
  count: number,
): string {
  const verb = count === 1 ? "needs attention" : "need attention";
  return `${label}: ${count} ${verb} (${ACTIONABLE_WORD[kind]})`;
}

/**
 * Shared status mark for a tab/workspace's Agent Attention Rail state.
 * Renders by precedence, driven entirely by `summary.kind` (already the
 * highest-precedence state across the tab's panes — see AgentAttentionSummary):
 *   actionable (error/warning/requested/completed) → an interactive button
 *   working                                        → a spinner status
 *   unread                                          → a dot status
 *   idle                                            → nothing
 * Only the actionable mark is interactive; working/unread are decoration.
 */
export function AgentAttentionMark({
  summary,
  label,
  onActivate,
}: AgentAttentionMarkProps) {
  const { kind } = summary;

  if (isActionableKind(kind)) {
    return (
      <button
        type="button"
        class={`attn-mark attn-mark--${kind}`}
        aria-label={actionableAriaLabel(label, kind, summary.actionableCount)}
        onClick={() => onActivate?.()}
      >
        <span class="attn-mark__badge" aria-hidden="true">
          {summary.actionableCount}
        </span>
      </button>
    );
  }

  if (kind === "working") {
    return (
      <span
        class="attn-mark attn-mark--working"
        role="status"
        aria-label={`${label}: agent working`}
      >
        <WorkspaceSpinner />
      </span>
    );
  }

  if (kind === "unread") {
    return (
      <span
        class="attn-mark attn-mark--unread"
        role="status"
        aria-label={`${label}: unread output`}
      >
        <span class="attn-mark__dot" aria-hidden="true" />
      </span>
    );
  }

  return null;
}

export type { AgentAttentionMarkProps };
