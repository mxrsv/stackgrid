interface ColorFieldProps {
  label: string;
  value: string;
  overridden: boolean;
  onChange: (hex: string) => void;
  onClear: () => void;
}

export function ColorField({
  label,
  value,
  overridden,
  onChange,
  onClear,
}: ColorFieldProps) {
  return (
    <div class="color-field">
      <span class="color-field__label">{label}</span>
      <div class="color-field__controls">
        <input
          type="color"
          class="color-field__swatch"
          value={value}
          aria-label={`Pick ${label} color`}
          onInput={(event) => onChange(event.currentTarget.value)}
        />
        <code class="color-field__hex">{value}</code>
        {overridden && (
          <button
            type="button"
            class="color-field__clear"
            title="Reset to theme color"
            aria-label={`Reset ${label} to theme color`}
            onClick={onClear}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
