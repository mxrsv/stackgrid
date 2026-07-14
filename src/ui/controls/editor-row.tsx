import {
  EDITOR_PRESETS,
  isEditorId,
  type EditorId,
} from "../../lib/editor-command";
import { ConfigRow } from "./config-row";

interface EditorRowProps {
  value: EditorId;
  command: string;
  onChange: (id: EditorId) => void;
  onCommandChange: (command: string) => void;
}

/** menu value kind (DL-6), plus an inline command row when "custom…" is picked. */
export function EditorRow({
  value,
  command,
  onChange,
  onCommandChange,
}: EditorRowProps) {
  const label =
    EDITOR_PRESETS.find((preset) => preset.id === value)?.label ?? value;

  return (
    <>
      <ConfigRow label="Editor" desc="⌘+click a file path">
        <span class="cfg-btn cfg-btn--overlay">
          <span class="cfg-btn__text">{label}</span>
          <span class="cfg-btn__hint">▾</span>
          <select
            value={value}
            aria-label="Editor"
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isEditorId(next)) {
                onChange(next);
              }
            }}
          >
            {EDITOR_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </span>
      </ConfigRow>
      {value === "custom" && (
        <div class="cfg-custom">
          <input
            type="text"
            class="text-input text-input--mono"
            placeholder="e.g. vim +{line} {file}"
            value={command}
            aria-label="Custom editor command"
            onChange={(event) => {
              onCommandChange(event.currentTarget.value.trim());
            }}
          />
        </div>
      )}
    </>
  );
}
