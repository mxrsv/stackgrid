import { letterAvatar } from "../lib/letter-avatar";
import { tabDotCssColor } from "../lib/tab-colors";
import { resolveWorkspaceLogo } from "../settings/workspace-logo-store";

interface WorkspaceLogoProps {
  /** Normalized workspace path; null when the tab has no workspace. */
  workspacePath: string | null;
  /** Display label — first letter feeds the fallback avatar. */
  label: string;
  /** An agent is running in this tab → spinner ring around the avatar. */
  pending: boolean;
  /** Background output arrived while the tab was inactive → yellow badge. */
  unread: boolean;
}

/**
 * The round identity mark for a workspace row: a custom logo, else the repo's
 * favicon, else a letter avatar on a theme color. A status overlay sits at the
 * corner: a spinner ring while an agent runs (pending), else a yellow dot for
 * unread background output, else nothing. Pending outranks unread.
 */
export function WorkspaceLogo({
  workspacePath,
  label,
  pending,
  unread,
}: WorkspaceLogoProps) {
  const image = resolveWorkspaceLogo(workspacePath);
  const avatar = letterAvatar(label, workspacePath ?? label);

  return (
    <span class="wsitem__logo">
      {image !== null ? (
        <img class="wsitem__logo-img" src={image} alt="" />
      ) : (
        <span
          class="wsitem__logo-letter"
          style={{
            color: tabDotCssColor(avatar.color),
            background: `color-mix(in srgb, ${tabDotCssColor(avatar.color)} 18%, transparent)`,
          }}
          aria-hidden="true"
        >
          {avatar.letter}
        </span>
      )}
      {pending ? (
        <span class="wsitem__spinner" aria-hidden="true" />
      ) : unread ? (
        <span
          class="wsitem__logo-badge wsitem__logo-badge--unread"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
