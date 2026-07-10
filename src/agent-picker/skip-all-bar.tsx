import { useEffect } from "preact/hooks";
import { pendingPaneIds, skipAll } from "./picker-store";

/** Global one-shot bar: Skip all → every still-pending pane stays a shell. */
export function SkipAllBar() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (pendingPaneIds.value.length === 0) {
        return;
      }
      // ⌘Return or ⌥S (event.code — Alt+S composes "ß" in event.key)
      const isSkip =
        (event.metaKey && event.key === "Enter") ||
        (event.altKey && event.code === "KeyS");
      if (isSkip) {
        event.preventDefault();
        event.stopPropagation();
        skipAll();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  if (pendingPaneIds.value.length === 0) {
    return null;
  }
  return (
    <div class="skip-all-bar">
      <span>Agent picker · one-shot</span>
      <button onClick={skipAll}>Skip all →</button>
    </div>
  );
}
