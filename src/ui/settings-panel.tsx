import {
  resetSettings,
  settings,
  updateColorOverride,
  updateSettings,
} from "../settings/settings-store";
import {
  clampFontSize,
  COLOR_KEYS,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type SidebarPosition,
  type TerminalColors,
} from "../settings/settings-schema";
import { getPreset, THEME_PRESETS } from "../settings/themes";
import { ColorField } from "./controls/color-field";
import { FontSelect } from "./controls/font-select";

const COLOR_LABELS: Record<keyof TerminalColors, string> = {
  background: "Background",
  foreground: "Foreground",
  cursor: "Cursor",
  selectionBackground: "Selection",
};

const POSITIONS: ReadonlyArray<{ value: SidebarPosition; label: string }> = [
  { value: "left", label: "Left" },
  { value: "top", label: "Top" },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const current = settings.value;
  const preset = getPreset(current.themeId);

  const stepFontSize = (delta: number): void => {
    updateSettings({ fontSize: clampFontSize(current.fontSize + delta) });
  };

  return (
    <aside class="settings-panel" aria-label="Settings">
      <header class="settings-panel__header">
        <h2 class="settings-panel__title">Settings</h2>
        <button
          type="button"
          class="settings-panel__close"
          aria-label="Close settings"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      <section class="settings-section">
        <h3 class="settings-section__title">Font</h3>
        <FontSelect
          value={current.fontFamily}
          onChange={(fontFamily) => updateSettings({ fontFamily })}
        />
        <div class="field">
          <span class="field__label">Font size</span>
          <div class="stepper">
            <button
              type="button"
              class="stepper__button"
              aria-label="Decrease font size"
              disabled={current.fontSize <= FONT_SIZE_MIN}
              onClick={() => stepFontSize(-1)}
            >
              −
            </button>
            <span class="stepper__value">{current.fontSize}</span>
            <button
              type="button"
              class="stepper__button"
              aria-label="Increase font size"
              disabled={current.fontSize >= FONT_SIZE_MAX}
              onClick={() => stepFontSize(1)}
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">Colors</h3>
        <div class="field">
          <label class="field__label" for="theme-preset">
            Theme
          </label>
          <select
            id="theme-preset"
            class="select"
            value={current.themeId}
            onChange={(event) =>
              // Switching theme clears previous color overrides
              updateSettings({
                themeId: event.currentTarget.value,
                colorOverrides: {},
              })
            }
          >
            {THEME_PRESETS.map((themePreset) => (
              <option key={themePreset.id} value={themePreset.id}>
                {themePreset.label}
              </option>
            ))}
          </select>
        </div>
        {COLOR_KEYS.map((key) => (
          <ColorField
            key={key}
            label={COLOR_LABELS[key]}
            value={current.colorOverrides[key] ?? preset.theme[key]}
            overridden={current.colorOverrides[key] !== undefined}
            onChange={(hex) => updateColorOverride(key, hex)}
            onClear={() => updateColorOverride(key, undefined)}
          />
        ))}
      </section>

      <section class="settings-section">
        <h3 class="settings-section__title">Sidebar</h3>
        <div class="field">
          <span class="field__label">Position</span>
          <div
            class="segmented"
            role="radiogroup"
            aria-label="Sidebar position"
          >
            {POSITIONS.map((position) => (
              <button
                key={position.value}
                type="button"
                role="radio"
                aria-checked={current.sidebarPosition === position.value}
                class={`segmented__option ${
                  current.sidebarPosition === position.value ? "is-active" : ""
                }`}
                onClick={() =>
                  updateSettings({ sidebarPosition: position.value })
                }
              >
                {position.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <footer class="settings-panel__footer">
        <button type="button" class="btn-reset" onClick={resetSettings}>
          Restore defaults
        </button>
      </footer>
    </aside>
  );
}
