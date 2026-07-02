import { useMemo, useState } from "preact/hooks";

const FONT_CANDIDATES = [
  "SF Mono",
  "Menlo",
  "Monaco",
  "JetBrains Mono",
  "Fira Code",
  "Cascadia Code",
  "Source Code Pro",
  "IBM Plex Mono",
  "Hack",
];

const CUSTOM_VALUE = "__custom__";

interface FontSelectProps {
  value: string;
  onChange: (family: string) => void;
}

export function FontSelect({ value, onChange }: FontSelectProps) {
  // Chỉ hiện các font thực sự có trên máy
  const available = useMemo(
    () =>
      FONT_CANDIDATES.filter((family) =>
        document.fonts.check(`12px "${family}"`),
      ),
    [],
  );
  const [customMode, setCustomMode] = useState(
    () => !available.includes(value),
  );

  const selectValue =
    customMode || !available.includes(value) ? CUSTOM_VALUE : value;

  return (
    <div class="field">
      <label class="field__label" for="font-family">
        Font
      </label>
      <select
        id="font-family"
        class="select"
        value={selectValue}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (next === CUSTOM_VALUE) {
            setCustomMode(true);
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      >
        {available.map((family) => (
          <option key={family} value={family}>
            {family}
          </option>
        ))}
        <option value={CUSTOM_VALUE}>Custom…</option>
      </select>
      {selectValue === CUSTOM_VALUE && (
        <input
          type="text"
          class="text-input"
          placeholder='VD: "Iosevka", monospace'
          value={value}
          aria-label="Tên font tùy chỉnh"
          onChange={(event) => {
            const next = event.currentTarget.value.trim();
            if (next !== "") {
              onChange(next);
            }
          }}
        />
      )}
    </div>
  );
}
