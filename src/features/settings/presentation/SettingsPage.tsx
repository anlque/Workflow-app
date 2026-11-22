import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';

import { Button, Icon, SegmentedControl, Switch } from '@/shared';

import type { Settings } from '../domain/Settings';

export type SettingsPageProps = Readonly<{
  settings: Settings;
  onUpdate(settings: Settings): Promise<void>;
  onExportSettings(): Promise<void>;
  onImportSettings(file: File): Promise<void>;
}>;

type Operation = 'preferences' | 'export-settings' | 'import-settings';

const themeOptions = [
  {
    value: 'system',
    label: 'System',
    image: '/seed/backgrounds/mosswood-canopy.webp',
  },
  {
    value: 'light',
    label: 'Light',
    image: '/seed/backgrounds/rainlit-window.webp',
  },
  {
    value: 'dark',
    label: 'Dark',
    image: '/seed/backgrounds/deep-tide.webp',
  },
] as const;

function SettingsCardHeader({
  id,
  icon,
  title,
  description,
}: Readonly<{
  id: string;
  icon: 'appearance' | 'sound' | 'tuning' | 'data';
  title: string;
  description: string;
}>) {
  return (
    <header className="settings-card__header">
      <span className="settings-card__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="settings-card__heading">
        <h3 id={id}>{title}</h3>
        <span>{description}</span>
      </span>
    </header>
  );
}

export function SettingsPage({
  settings,
  onUpdate,
  onExportSettings,
  onImportSettings,
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
    operation: 'import-settings',
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

      <section
        className="settings-group settings-card"
        role="group"
        aria-labelledby="settings-appearance-title"
      >
        <SettingsCardHeader
          id="settings-appearance-title"
          icon="appearance"
          title="Appearance"
          description="Choose a theme and customize interface motion."
        />
        <div className="settings-card__divider" />
        <div className="settings-appearance-grid">
          <div className="settings-appearance-primary">
            <fieldset className="settings-theme-options" role="radiogroup">
              <legend>Theme</legend>
              <div className="settings-theme-options__grid">
                {themeOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`settings-theme-option settings-theme-option--${option.value}`}
                    style={
                      {
                        '--settings-theme-preview': `url('${option.image}')`,
                      } as CSSProperties
                    }
                  >
                    <input
                      type="radio"
                      name="settings-theme"
                      value={option.value}
                      checked={settings.theme === option.value}
                      disabled={pending === 'preferences'}
                      onChange={() => {
                        void perform(
                          'preferences',
                          () => onUpdate({ ...settings, theme: option.value }),
                          'Theme updated.',
                        );
                      }}
                    />
                    <span
                      className="settings-theme-option__preview"
                      aria-hidden="true"
                    />
                    <span className="settings-theme-option__label">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="settings-motion-control">
              <strong>Motion</strong>
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
      </section>

      <section
        className="settings-group settings-card settings-card--audio"
        role="group"
        aria-labelledby="settings-audio-title"
      >
        <SettingsCardHeader
          id="settings-audio-title"
          icon="sound"
          title="Audio"
          description="Control ambient music and interface cues independently."
        />
        <div className="settings-card__divider" />
        <div className="settings-audio-rows">
          <div className="settings-audio-row">
            <span className="settings-audio-row__icon" aria-hidden="true">
              <Icon name="music" />
            </span>
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
            <span className="settings-audio-row__icon" aria-hidden="true">
              <Icon name="bell" />
            </span>
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
            <span className="settings-audio-row__icon" aria-hidden="true">
              <Icon name="bellOff" />
            </span>
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
      </section>

      <div className="settings-bottom-grid">
        <section
          className="settings-group settings-card settings-card--controls"
          role="group"
          aria-labelledby="settings-controls-title"
        >
          <SettingsCardHeader
            id="settings-controls-title"
            icon="tuning"
            title="Controls"
            description="Choose how keyboard shortcuts behave in Focus."
          />
          <div className="settings-card__divider" />
          <div className="settings-controls-row">
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
          </div>
        </section>

        <section
          className="settings-group settings-card"
          role="group"
          aria-labelledby="settings-data-title"
        >
          <SettingsCardHeader
            id="settings-data-title"
            icon="data"
            title="Application data"
            description="Export or restore appearance, audio and control preferences. Workflows and Assets are not included."
          />
          <div className="settings-card__divider" />
          <div className="settings-application-grid">
            <div className="settings-application-action">
              <strong>Export settings</strong>
              <span>Save the current preferences as a local JSON package.</span>
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
                <Icon name="export" size={18} />
                Export settings
              </Button>
            </div>
            <div className="settings-application-action">
              <strong>Import settings</strong>
              <span>Restore a validated Locusora Settings package.</span>
              <label className="button button--secondary asset-upload">
                <Icon name="chooseFile" size={18} />
                {pending === 'import-settings'
                  ? 'Importing…'
                  : 'Import settings'}
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
          </div>
          <p className="settings-privacy-note">
            Settings remain local unless you choose to export them. Imported
            files are validated before preferences change.
          </p>
          {status('export-settings')}
          {status('import-settings')}
        </section>
      </div>
    </section>
  );
}
