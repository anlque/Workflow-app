import { useState } from 'react';

import type { Theme } from '@/features/settings';

import type { SettingsPatch } from './createSettingsUpdater';

type AppearancePreferences = Readonly<{
  theme: Theme;
  backgroundBlurPx: number;
  backgroundBrightnessPercent: number;
}>;

export function FocusAppearanceControls({
  preferences,
  onUpdate,
}: Readonly<{
  preferences: AppearancePreferences;
  onUpdate(patch: SettingsPatch): Promise<void>;
}>) {
  const [error, setError] = useState<string | null>(null);

  function update(patch: SettingsPatch): void {
    setError(null);
    void onUpdate(patch).catch((cause: unknown) => {
      setError(
        cause instanceof Error ? cause.message : 'Appearance update failed.',
      );
    });
  }

  return (
    <details className="focus-appearance">
      <summary>Appearance</summary>
      <div className="focus-appearance__controls">
        <label>
          <span>Focus theme</span>
          <select
            value={preferences.theme}
            onChange={(event) => {
              const value = event.currentTarget.value;
              update({
                theme: value === 'light' || value === 'dark' ? value : 'system',
              });
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>
          <span>Focus blur</span>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            value={preferences.backgroundBlurPx}
            onChange={(event) => {
              update({ backgroundBlurPx: Number(event.currentTarget.value) });
            }}
          />
          <output>{preferences.backgroundBlurPx} px</output>
        </label>
        <label>
          <span>Focus brightness</span>
          <input
            type="range"
            min="50"
            max="150"
            step="5"
            value={preferences.backgroundBrightnessPercent}
            onChange={(event) => {
              update({
                backgroundBrightnessPercent: Number(event.currentTarget.value),
              });
            }}
          />
          <output>{preferences.backgroundBrightnessPercent}%</output>
        </label>
        {error === null ? null : <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
