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

// Compare rendered width against fallback fonts — document.fonts.check()
// returns false positives for system fonts that are not installed
function detectInstalledFonts(): string[] {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    return FONT_CANDIDATES;
  }
  const sample = "mmmmmmmmmmlliWQ@#1470";
  const measure = (font: string): number => {
    context.font = font;
    return context.measureText(sample).width;
  };
  const baselineMono = measure("16px monospace");
  const baselineSerif = measure("16px serif");
  return FONT_CANDIDATES.filter(
    (family) =>
      measure(`16px "${family}", monospace`) !== baselineMono ||
      measure(`16px "${family}", serif`) !== baselineSerif,
  );
}

interface FontSelectProps {
  value: string;
  onChange: (family: string) => void;
}

export function FontSelect({ value, onChange }: FontSelectProps) {
  // Only list fonts actually installed; keep the currently selected one
  const available = useMemo(() => {
    const detected = detectInstalledFonts();
    if (!detected.includes(value) && FONT_CANDIDATES.includes(value)) {
      return [value, ...detected];
    }
    return detected;
  }, []);
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
          placeholder='e.g. "Iosevka", monospace'
          value={value}
          aria-label="Custom font name"
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
