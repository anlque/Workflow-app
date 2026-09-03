import { useState, type ChangeEvent } from 'react';

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
  const [feedback, setFeedback] = useState<Readonly<{
    operation: Operation;
    message: string;
    error: boolean;
  }> | null>(null);

  async function perform(
    operation: Operation,
    action: () => Promise<void>,
    success: string,
  ): Promise<void> {
    setPending(operation);
    setFeedback(null);
    try {
      await action();
      setFeedback({ operation, message: success, error: false });
    } catch (cause) {
      setFeedback({
        operation,
        message:
          cause instanceof Error ? cause.message : 'The operation failed.',
        error: true,
      });
    } finally {
      setPending(null);
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
