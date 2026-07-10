import { useEffect } from "preact/hooks";
import { persistError } from "./ui-signals";

const AUTO_DISMISS_MS = 6000;

/** Surfaces a silent store.set/save() failure (presets, workspaces recents)
 * so the user knows a change may not survive a relaunch — see persist()
 * in presets-store.ts / recordWorkspaceOpen() in workspaces-store.ts. */
export function PersistErrorBar() {
  useEffect(() => {
    if (persistError.value === null) {
      return;
    }
    const timer = setTimeout(() => {
      persistError.value = null;
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [persistError.value]);

  if (persistError.value === null) {
    return null;
  }
  return (
    <div class="persist-error-bar">
      <span>⚠ {persistError.value}</span>
      <button onClick={() => (persistError.value = null)}>Dismiss</button>
    </div>
  );
}
