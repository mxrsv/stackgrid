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

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const current = settings.value;
  const preset = getPreset(current.themeId);

  const stepFontSize = (delta: number): void => {
    updateSettings({ fontSize: clampFontSize(current.fontSize + delta) });
  };

  return (
    <aside
      class={`panel ${open ? "is-open" : ""}`}
      aria-label="Settings"
      aria-hidden={!open}
    >
      <header class="panel__head">
        <h2 class="panel__title">Settings</h2>
        <button
          type="button"
          class="panel__x"
          aria-label="Close settings"
          onClick={onClose}
        >
          ✕
        </button>
      </header>

      <div class="panel__body">
        <section class="panel__sec">
          <h3 class="panel__sec-title">Theme</h3>
          <div class="theme-grid">
            {THEME_PRESETS.map((themePreset) => (
              <button
                key={themePreset.id}
                type="button"
                class={`theme-chip ${
                  themePreset.id === current.themeId ? "is-active" : ""
                }`}
                onClick={() =>
                  // Switching theme clears previous color overrides
                  updateSettings({
                    themeId: themePreset.id,
                    colorOverrides: {},
                  })
                }
              >
                <span
                  class="theme-chip__swatch"
                  style={{
                    background: themePreset.theme.background,
                    borderColor: themePreset.theme.blue,
                  }}
                />
                {themePreset.label}
              </button>
            ))}
          </div>
        </section>

        <section class="panel__sec">
          <h3 class="panel__sec-title">Font</h3>
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

        <section class="panel__sec">
          <h3 class="panel__sec-title">Colors</h3>
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

        <section class="panel__sec">
          <h3 class="panel__sec-title">Panes</h3>
          <div class="field">
            <span class="field__label">Show pane bar</span>
            <div class="segmented" role="radiogroup" aria-label="Show pane bar">
              <button
                type="button"
                role="radio"
                aria-checked={current.showPaneBar}
                class={`segmented__option ${current.showPaneBar ? "is-active" : ""}`}
                onClick={() => updateSettings({ showPaneBar: true })}
              >
                On
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!current.showPaneBar}
                class={`segmented__option ${current.showPaneBar ? "" : "is-active"}`}
                onClick={() => updateSettings({ showPaneBar: false })}
              >
                Off
              </button>
            </div>
          </div>
        </section>

        <section class="panel__sec">
          <h3 class="panel__sec-title">Tabs</h3>
          <div class="field">
            <span class="field__label">Restore on launch</span>
            <div
              class="segmented"
              role="radiogroup"
              aria-label="Restore tabs on launch"
            >
              <button
                type="button"
                role="radio"
                aria-checked={current.restoreTabs}
                class={`segmented__option ${current.restoreTabs ? "is-active" : ""}`}
                onClick={() => updateSettings({ restoreTabs: true })}
              >
                On
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={!current.restoreTabs}
                class={`segmented__option ${current.restoreTabs ? "" : "is-active"}`}
                onClick={() => updateSettings({ restoreTabs: false })}
              >
                Off
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="panel__footer">
        <button type="button" class="btn-reset" onClick={resetSettings}>
          Restore defaults
        </button>
      </footer>
    </aside>
  );
}
