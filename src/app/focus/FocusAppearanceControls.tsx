import { useEffect, useRef, useState } from 'react';

import type { SettingsPatch } from './createSettingsUpdater';

type AppearancePreferences = Readonly<{
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
  const [blurDraft, setBlurDraft] = useState(preferences.backgroundBlurPx);
  const [brightnessDraft, setBrightnessDraft] = useState(
    preferences.backgroundBrightnessPercent,
  );
  const committed = useRef({
    backgroundBlurPx: preferences.backgroundBlurPx,
    backgroundBrightnessPercent: preferences.backgroundBrightnessPercent,
  });

  useEffect(() => {
    setBlurDraft(preferences.backgroundBlurPx);
    setBrightnessDraft(preferences.backgroundBrightnessPercent);
    committed.current = {
      backgroundBlurPx: preferences.backgroundBlurPx,
      backgroundBrightnessPercent: preferences.backgroundBrightnessPercent,
    };
  }, [preferences.backgroundBlurPx, preferences.backgroundBrightnessPercent]);

  function commitAppearance(
    field: 'backgroundBlurPx' | 'backgroundBrightnessPercent',
    value: number,
  ): void {
    const previous = committed.current[field];
    if (value === previous) return;
    committed.current = { ...committed.current, [field]: value };
    setError(null);
    void onUpdate({ [field]: value }).catch((cause: unknown) => {
      committed.current = { ...committed.current, [field]: previous };
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
          <span>Focus blur</span>
          <input
            type="range"
            min="0"
            max="24"
            step="1"
            value={blurDraft}
            onChange={(event) => {
              setBlurDraft(Number(event.currentTarget.value));
            }}
            onPointerUp={() => {
              commitAppearance('backgroundBlurPx', blurDraft);
            }}
            onBlur={() => {
              commitAppearance('backgroundBlurPx', blurDraft);
            }}
          />
          <output>{blurDraft} px</output>
        </label>
        <label>
          <span>Focus brightness</span>
          <input
            type="range"
            min="50"
            max="150"
            step="5"
            value={brightnessDraft}
            onChange={(event) => {
              setBrightnessDraft(Number(event.currentTarget.value));
            }}
            onPointerUp={() => {
              commitAppearance('backgroundBrightnessPercent', brightnessDraft);
            }}
            onBlur={() => {
              commitAppearance('backgroundBrightnessPercent', brightnessDraft);
            }}
          />
          <output>{brightnessDraft}%</output>
        </label>
        {error === null ? null : <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
