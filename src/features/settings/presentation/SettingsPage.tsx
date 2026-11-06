import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Button, SegmentedControl, Switch } from '@/shared';

import type { Settings } from '../domain/Settings';

export type SettingsPageProps = Readonly<{
  settings: Settings;
  onUpdate(settings: Settings): Promise<void>;
  onExportSettings(): Promise<void>;
  onImportSettings(file: File): Promise<void>;
  onExportWorkflow(): Promise<void>;
  onImportWorkflow(file: File): Promise<void>;
}>;

type Operation =
  | 'preferences'
  | 'export-settings'
  | 'import-settings'
  | 'export-workflow'
  | 'import-workflow';

export function SettingsPage({
  settings,
  onUpdate,
  onExportSettings,
  onImportSettings,
  onExportWorkflow,
  onImportWorkflow,
}: SettingsPageProps) {
  const [pending, setPending] = useState<Operation | null>(null);
  const [ambientVolumeDraft, setAmbientVolumeDraft] = useState(
    settings.ambientVolumePercent,
  );
  const [cueVolumeDraft, setCueVolumeDraft] = useState(
    settings.cueVolumePercent,
  );
  const [blurDraft, setBlurDraft] = useState(settings.backgroundBlurPx);
  const [brightnessDraft, setBrightnessDraft] = useState(
    settings.backgroundBrightnessPercent,
  );
  const committedVolumes = useRef({
    ambientVolumePercent: settings.ambientVolumePercent,
    cueVolumePercent: settings.cueVolumePercent,
  });
  const committedAppearance = useRef({
    backgroundBlurPx: settings.backgroundBlurPx,
    backgroundBrightnessPercent: settings.backgroundBrightnessPercent,
  });
  const [feedback, setFeedback] = useState<Readonly<{
    operation: Operation;
    message: string;
    error: boolean;
  }> | null>(null);

  useEffect(() => {
    setAmbientVolumeDraft(settings.ambientVolumePercent);
    setCueVolumeDraft(settings.cueVolumePercent);
    committedVolumes.current = {
      ambientVolumePercent: settings.ambientVolumePercent,
      cueVolumePercent: settings.cueVolumePercent,
    };
  }, [settings.ambientVolumePercent, settings.cueVolumePercent]);

  useEffect(() => {
    setBlurDraft(settings.backgroundBlurPx);
    setBrightnessDraft(settings.backgroundBrightnessPercent);
    committedAppearance.current = {
      backgroundBlurPx: settings.backgroundBlurPx,
      backgroundBrightnessPercent: settings.backgroundBrightnessPercent,
    };
  }, [settings.backgroundBlurPx, settings.backgroundBrightnessPercent]);

  async function perform(
    operation: Operation,
    action: () => Promise<void>,
    success: string,
  ): Promise<boolean> {
    setPending(operation);
    setFeedback(null);
    try {
      await action();
      setFeedback({ operation, message: success, error: false });
      return true;
    } catch (cause) {
      setFeedback({
        operation,
        message:
          cause instanceof Error ? cause.message : 'The operation failed.',
        error: true,
      });
      return false;
    } finally {
      setPending(null);
    }
  }

  async function commitVolume(
    field: 'ambientVolumePercent' | 'cueVolumePercent',
    value: number,
  ): Promise<void> {
    const previous = committedVolumes.current[field];
    if (value === previous) return;
    committedVolumes.current = { ...committedVolumes.current, [field]: value };
    const saved = await perform(
      'preferences',
      () =>
        onUpdate({
          ...settings,
          ambientVolumePercent: ambientVolumeDraft,
          cueVolumePercent: cueVolumeDraft,
          [field]: value,
        }),
      'Audio preferences updated.',
    );
    if (!saved) {
      committedVolumes.current = {
        ...committedVolumes.current,
        [field]: previous,
      };
    }
  }

  async function commitAppearance(
    field: 'backgroundBlurPx' | 'backgroundBrightnessPercent',
    value: number,
  ): Promise<void> {
    const previous = committedAppearance.current[field];
    if (value === previous) return;
    committedAppearance.current = {
      ...committedAppearance.current,
      [field]: value,
    };
    const saved = await perform(
      'preferences',
      () =>
        onUpdate({
          ...settings,
          backgroundBlurPx: blurDraft,
          backgroundBrightnessPercent: brightnessDraft,
          [field]: value,
        }),
      'Appearance preferences updated.',
    );
    if (!saved) {
      committedAppearance.current = {
        ...committedAppearance.current,
        [field]: previous,
      };
    }
  }

  function importFile(
    operation: 'import-settings' | 'import-workflow',
    action: (file: File) => Promise<void>,
    success: string,
  ): (event: ChangeEvent<HTMLInputElement>) => void {
    return (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file !== undefined)
        void perform(operation, () => action(file), success);
    };
  }

  const status = (operation: Operation) =>
    feedback?.operation === operation ? (
      <p
        className={
          feedback.error
            ? 'feedback feedback--error'
            : 'feedback feedback--success'
        }
        role={feedback.error ? 'alert' : 'status'}
      >
        {feedback.message}
      </p>
    ) : null;

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <header>
        <h2 id="settings-title">Settings</h2>
        <p>Choose how Locusora looks, moves and carries your data.</p>
      </header>
      {status('preferences')}

      <fieldset className="settings-group">
        <legend>Appearance</legend>
        <div className="settings-appearance-grid">
          <div className="settings-appearance-modes">
            <SegmentedControl
              label="Theme"
              value={settings.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              disabled={pending === 'preferences'}
              onChange={(theme) => {
                void perform(
                  'preferences',
                  () => onUpdate({ ...settings, theme }),
                  'Theme updated.',
                );
              }}
            />
            <SegmentedControl
              label="Reduced motion"
              value={settings.reducedMotion}
              options={[
                { value: 'system', label: 'System' },
                { value: 'reduce', label: 'Reduce motion' },
                { value: 'no-preference', label: 'Allow motion' },
              ]}
              disabled={pending === 'preferences'}
              onChange={(reducedMotion) => {
                void perform(
                  'preferences',
                  () => onUpdate({ ...settings, reducedMotion }),
                  'Motion preference updated.',
                );
              }}
            />
          </div>
          <div className="settings-appearance-ranges">
            <label>
              <span>Background blur</span>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={blurDraft}
                disabled={pending === 'preferences'}
                onChange={(event) => {
                  setBlurDraft(Number(event.currentTarget.value));
                }}
                onPointerUp={() =>
                  void commitAppearance('backgroundBlurPx', blurDraft)
                }
                onBlur={() =>
                  void commitAppearance('backgroundBlurPx', blurDraft)
                }
              />
              <output>{blurDraft} px</output>
            </label>
            <label>
              <span>Background brightness</span>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={brightnessDraft}
                disabled={pending === 'preferences'}
                onChange={(event) => {
                  setBrightnessDraft(Number(event.currentTarget.value));
                }}
                onPointerUp={() =>
                  void commitAppearance(
                    'backgroundBrightnessPercent',
                    brightnessDraft,
                  )
                }
                onBlur={() =>
                  void commitAppearance(
                    'backgroundBrightnessPercent',
                    brightnessDraft,
                  )
                }
              />
              <output>{brightnessDraft}%</output>
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Audio</legend>
        <p>Control ambient music and interface cues independently.</p>
        <div className="settings-audio-rows">
          <div className="settings-audio-row">
            <span className="settings-audio-row__copy">
              <strong>Music</strong>
              <span>Ambient tracks during phases.</span>
            </span>
            <label className="settings-audio-row__volume">
              <span>Music volume</span>
              <input
                aria-label="Music volume"
                type="range"
                min="0"
                max="100"
                step="1"
                value={ambientVolumeDraft}
                disabled={pending === 'preferences'}
                onChange={(event) => {
                  setAmbientVolumeDraft(Number(event.currentTarget.value));
                }}
                onPointerUp={() =>
                  void commitVolume('ambientVolumePercent', ambientVolumeDraft)
                }
                onBlur={() =>
                  void commitVolume('ambientVolumePercent', ambientVolumeDraft)
                }
              />
              <output>{ambientVolumeDraft}%</output>
            </label>
            <Switch
              label="Music on"
              checked={!settings.ambientMuted}
              disabled={pending === 'preferences'}
              onChange={(musicOn) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      ambientMuted: !musicOn,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
          </div>
          <div className="settings-audio-row">
            <span className="settings-audio-row__copy">
              <strong>Cues</strong>
              <span>Bells, rewards and completion sounds.</span>
            </span>
            <label className="settings-audio-row__volume">
              <span>Cue volume</span>
              <input
                aria-label="Cue volume"
                type="range"
                min="0"
                max="100"
                step="1"
                value={cueVolumeDraft}
                disabled={pending === 'preferences'}
                onChange={(event) => {
                  setCueVolumeDraft(Number(event.currentTarget.value));
                }}
                onPointerUp={() =>
                  void commitVolume('cueVolumePercent', cueVolumeDraft)
                }
                onBlur={() =>
                  void commitVolume('cueVolumePercent', cueVolumeDraft)
                }
              />
              <output>{cueVolumeDraft}%</output>
            </label>
            <Switch
              label="Cues on"
              checked={!settings.cuesMuted}
              disabled={pending === 'preferences'}
              onChange={(cuesOn) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      cuesMuted: !cuesOn,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
          </div>
          <div className="settings-audio-row settings-audio-row--switch-only">
            <span className="settings-audio-row__copy">
              <strong>Mute cues with music</strong>
              <span>Muting music also silences cues when enabled.</span>
            </span>
            <Switch
              label="Mute cues with music"
              displayLabel={settings.muteCuesWithMusic ? 'On' : 'Off'}
              checked={settings.muteCuesWithMusic}
              disabled={pending === 'preferences'}
              onChange={(muteCuesWithMusic) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      muteCuesWithMusic,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Controls</legend>
        <Switch
          label="Pause or resume with Space"
          description="Use the Space key while Focus is active."
          checked={settings.pauseWithSpace}
          disabled={pending === 'preferences'}
          onChange={(pauseWithSpace) => {
            void perform(
              'preferences',
              () => onUpdate({ ...settings, pauseWithSpace }),
              'Control preferences updated.',
            );
          }}
        />
      </fieldset>

      <fieldset className="settings-group">
        <legend>Workflow data</legend>
        <p>Move the selected Workflow and its referenced local Assets.</p>
        <div className="settings-actions">
          <Button
            variant="secondary"
            pending={pending === 'export-workflow'}
            pendingLabel="Exporting…"
            onClick={() =>
              void perform(
                'export-workflow',
                onExportWorkflow,
                'Workflow exported.',
              )
            }
          >
            Export workflow
          </Button>
          <label className="button button--secondary asset-upload">
            {pending === 'import-workflow' ? 'Importing…' : 'Import workflow'}
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import workflow file"
              disabled={pending === 'import-workflow'}
              onChange={importFile(
                'import-workflow',
                onImportWorkflow,
                'Workflow imported.',
              )}
            />
          </label>
        </div>
        {status('export-workflow')}
        {status('import-workflow')}
      </fieldset>

      <fieldset className="settings-group">
        <legend>Application settings</legend>
        <p>Move theme and motion preferences without changing Workflows.</p>
        <div className="settings-actions">
          <Button
            variant="secondary"
            pending={pending === 'export-settings'}
            pendingLabel="Exporting…"
            onClick={() =>
              void perform(
                'export-settings',
                onExportSettings,
                'Settings exported.',
              )
            }
          >
            Export settings
          </Button>
          <label className="button button--secondary asset-upload">
            {pending === 'import-settings' ? 'Importing…' : 'Import settings'}
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import settings file"
              disabled={pending === 'import-settings'}
              onChange={importFile(
                'import-settings',
                onImportSettings,
                'Settings imported.',
              )}
            />
          </label>
        </div>
        {status('export-settings')}
        {status('import-settings')}
      </fieldset>
    </section>
  );
}
