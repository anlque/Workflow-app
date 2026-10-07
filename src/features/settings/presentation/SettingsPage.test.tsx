import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { Settings } from '../domain/Settings';
import { SettingsPage } from './SettingsPage';

const settings: Settings = {
  theme: 'system',
  reducedMotion: 'system',
  ambientVolumePercent: 80,
  ambientMuted: false,
  cueVolumePercent: 60,
  cuesMuted: false,
  muteCuesWithMusic: false,
};

function setup(
  overrides: Partial<{
    onUpdate(settings: Settings): Promise<void>;
    onExportSettings(): Promise<void>;
    onImportSettings(file: File): Promise<void>;
    onExportWorkflow(): Promise<void>;
    onImportWorkflow(file: File): Promise<void>;
  }> = {},
) {
  const props = {
    onUpdate: vi.fn<(value: Settings) => Promise<void>>(
      overrides.onUpdate ?? (() => Promise.resolve()),
    ),
    onExportSettings: vi.fn(
      overrides.onExportSettings ?? (() => Promise.resolve()),
    ),
    onImportSettings: vi.fn<(file: File) => Promise<void>>(
      overrides.onImportSettings ?? (() => Promise.resolve()),
    ),
    onExportWorkflow: vi.fn(
      overrides.onExportWorkflow ?? (() => Promise.resolve()),
    ),
    onImportWorkflow: vi.fn<(file: File) => Promise<void>>(
      overrides.onImportWorkflow ?? (() => Promise.resolve()),
    ),
  };
  render(<SettingsPage settings={settings} {...props} />);
  return props;
}

describe('SettingsPage', () => {
  test('updates independent audio channels and optional mute coupling', async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    await user.click(screen.getByRole('checkbox', { name: 'Mute music' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      ambientMuted: true,
    });

    fireEvent.change(screen.getByRole('slider', { name: 'Cue volume' }), {
      target: { value: '35' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      cueVolumePercent: 35,
    });

    await user.click(
      screen.getByRole('checkbox', { name: 'Mute cues with music' }),
    );
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      muteCuesWithMusic: true,
    });
  });
  test('updates theme and reduced-motion preferences independently', async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    await user.selectOptions(screen.getByLabelText('Reduced motion'), 'reduce');

    expect(onUpdate).toHaveBeenNthCalledWith(1, {
      ...settings,
      theme: 'dark',
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      ...settings,
      reducedMotion: 'reduce',
    });
  });

  test('runs separate Workflow and Settings exports with feedback', async () => {
    const user = userEvent.setup();
    const { onExportWorkflow, onExportSettings } = setup();

    await user.click(screen.getByRole('button', { name: 'Export workflow' }));
    expect(await screen.findByText('Workflow exported.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Export settings' }));
    expect(await screen.findByText('Settings exported.')).toBeVisible();

    expect(onExportWorkflow).toHaveBeenCalledOnce();
    expect(onExportSettings).toHaveBeenCalledOnce();
  });

  test('passes selected import files and announces an error', async () => {
    const user = userEvent.setup();
    const onImportSettings = vi.fn<(file: File) => Promise<void>>(() =>
      Promise.reject(new Error('Settings package is invalid.')),
    );
    setup({ onImportSettings });
    const file = new File(['{}'], 'settings.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Import settings file'), file);

    expect(onImportSettings).toHaveBeenCalledWith(file);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Settings package is invalid.',
    );
  });
});
