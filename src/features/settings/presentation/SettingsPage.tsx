import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import { Button, Select } from '@/shared';

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
  const committedVolumes = useRef({
    ambientVolumePercent: settings.ambientVolumePercent,
    cueVolumePercent: settings.cueVolumePercent,
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

      <fieldset className="settings-group">
        <legend>Appearance</legend>
        <div className="form-grid">
          <Select
            label="Theme"
            value={settings.theme}
            disabled={pending === 'preferences'}
            onChange={(event) => {
              const theme =
                event.target.value === 'light' || event.target.value === 'dark'
                  ? event.target.value
                  : 'system';
              void perform(
                'preferences',
                () => onUpdate({ ...settings, theme }),
                'Theme updated.',
              );
            }}
          >
            <option value="system">Use system setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
          <Select
            label="Reduced motion"
            value={settings.reducedMotion}
            disabled={pending === 'preferences'}
            onChange={(event) => {
              const reducedMotion =
                event.target.value === 'reduce' ||
                event.target.value === 'no-preference'
                  ? event.target.value
                  : 'system';
              void perform(
                'preferences',
                () => onUpdate({ ...settings, reducedMotion }),
                'Motion preference updated.',
              );
            }}
          >
            <option value="system">Use system setting</option>
            <option value="reduce">Reduce motion</option>
            <option value="no-preference">Allow motion</option>
          </Select>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>Audio</legend>
        <p>Control ambient music and interface cues independently.</p>
        <div className="form-grid settings-audio-grid">
          <label>
            <input
              type="checkbox"
              checked={settings.ambientMuted}
              onChange={(event) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      ambientMuted: event.currentTarget.checked,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
            Mute music
          </label>
          <label>
            <span>Music volume</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={ambientVolumeDraft}
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
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.cuesMuted}
              onChange={(event) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      cuesMuted: event.currentTarget.checked,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
            Mute cues
          </label>
          <label>
            <span>Cue volume</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={cueVolumeDraft}
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
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.muteCuesWithMusic}
              onChange={(event) => {
                void perform(
                  'preferences',
                  () =>
                    onUpdate({
                      ...settings,
                      ambientVolumePercent: ambientVolumeDraft,
                      cueVolumePercent: cueVolumeDraft,
                      muteCuesWithMusic: event.currentTarget.checked,
                    }),
                  'Audio preferences updated.',
                );
              }}
            />
            Mute cues with music
          </label>
        </div>
        {status('preferences')}
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
