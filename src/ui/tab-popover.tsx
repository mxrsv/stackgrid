import { useEffect, useRef } from "preact/hooks";
import {
  TAB_DOT_COLORS,
  tabDotCssColor,
  type TabDotColor,
} from "../lib/tab-colors";

interface TabPopoverProps {
  /** Viewport coordinates of the anchor tab (fixed positioning). */
  left: number;
  top: number;
  /** The tab element the popover is anchored to — clicks on it are ignored
      by the outside-close listener so the tab's own onClick can toggle. */
  anchorEl: HTMLElement;
  /** Current overrides — null means "derived from process". */
  name: string | null;
  dotColor: TabDotColor | null;
  /** True when this workspace has a user-set custom logo (enables Remove). */
  hasLogo?: boolean;
  onRename(name: string | null): void;
  onPickColor(color: TabDotColor | null): void;
  /** Logo actions — only the sidebar wires these; absent hides the Logo row. */
  onSetLogo?(): void;
  onRemoveLogo?(): void;
  onClose(): void;
}

/** Options popover anchored under the active tab: rename + dot color. */
export function TabPopover(props: TabPopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on any pointerdown outside the popover (capture phase so a click
  // that also hits another tab closes us before it selects that tab).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !props.anchorEl.contains(target)
      ) {
        props.onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    inputRef.current?.focus();
    inputRef.current?.select();
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const commitRename = (): void => {
    const value = inputRef.current?.value.trim() ?? "";
    props.onRename(value === "" ? null : value);
    props.onClose();
  };

  return (
    <div
      ref={rootRef}
      class="tab-popover"
      role="dialog"
      aria-label="Tab options"
      style={{ left: `${props.left}px`, top: `${props.top}px` }}
    >
      <div class="tab-popover__label">Name</div>
      <input
        ref={inputRef}
        type="text"
        class="text-input"
        maxLength={64}
        placeholder="Process name"
        defaultValue={props.name ?? ""}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitRename();
          } else if (event.key === "Escape") {
            event.preventDefault();
            props.onClose();
          }
        }}
      />
      <div class="tab-popover__label">Dot color</div>
      <div class="tab-popover__colors" role="group" aria-label="Dot color">
        <button
          type="button"
          class={`tab-popover__swatch tab-popover__swatch--auto ${
            props.dotColor === null ? "is-active" : ""
          }`}
          title="Auto (from process)"
          aria-label="Automatic dot color"
          onClick={() => props.onPickColor(null)}
        >
          A
        </button>
        {TAB_DOT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            class={`tab-popover__swatch ${
              props.dotColor === color ? "is-active" : ""
            }`}
            style={{ background: tabDotCssColor(color) }}
            title={color}
            aria-label={`Dot color ${color}`}
            onClick={() => props.onPickColor(color)}
          />
        ))}
      </div>
      {props.onSetLogo && (
        <>
          <div class="tab-popover__label">Logo</div>
          <div
            class="tab-popover__logo"
            role="group"
            aria-label="Workspace logo"
          >
            <button
              type="button"
              class="tab-popover__logo-btn"
              onClick={props.onSetLogo}
            >
              Set logo…
            </button>
            {props.hasLogo && (
              <button
                type="button"
                class="tab-popover__logo-btn"
                onClick={props.onRemoveLogo}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
