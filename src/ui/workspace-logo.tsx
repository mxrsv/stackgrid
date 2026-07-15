import { letterAvatar } from "../lib/letter-avatar";
import { tabDotCssColor, type TabDotColor } from "../lib/tab-colors";
import { resolveWorkspaceLogo } from "../settings/workspace-logo-store";

interface WorkspaceLogoProps {
  /** Normalized workspace path; null when the tab has no workspace. */
  workspacePath: string | null;
  /** Display label — first letter feeds the fallback avatar. */
  label: string;
  /** An agent runs in this tab → show the corner badge. */
  busy: boolean;
  /** User-chosen dot color token for the busy badge; null = auto (accent). */
  dotColor: TabDotColor | null;
}

/**
 * The round identity mark for a workspace row: a custom logo, else the repo's
 * favicon, else a letter avatar on a theme color. A small dot badge sits in the
 * bottom-right corner while an agent is running.
 */
export function WorkspaceLogo({
  workspacePath,
  label,
  busy,
  dotColor,
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
      {busy ? (
        <span
          class="wsitem__logo-badge"
          style={{
            background: tabDotCssColor(dotColor ?? "accent"),
          }}
        />
      ) : null}
    </span>
  );
}
