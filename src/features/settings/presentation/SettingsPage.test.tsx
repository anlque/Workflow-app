import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  backgroundBlurPx: 0,
  backgroundBrightnessPercent: 100,
  pauseWithSpace: true,
};

function setup(
  overrides: Partial<{
    onUpdate(settings: Settings): Promise<void>;
    onExportSettings(): Promise<void>;
    onImportSettings(file: File): Promise<void>;
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
  };
  render(<SettingsPage settings={settings} {...props} />);
  return props;
}

describe('SettingsPage', () => {
  test('updates the global Focus Space control with accessible feedback', async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    const control = screen.getByRole('checkbox', {
      name: 'Pause or resume with Space',
    });
    expect(control).toBeChecked();
    expect(screen.getByRole('group', { name: 'Controls' })).toContainElement(
      control,
    );
    await user.click(control);

    expect(onUpdate).toHaveBeenCalledWith({
      ...settings,
      pauseWithSpace: false,
    });
    expect(
      await screen.findByText('Control preferences updated.'),
    ).toHaveAttribute('role', 'status');
  });
  test('updates independent audio channels and optional mute coupling', async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    const music = screen.getByRole('checkbox', { name: 'Music on' });
    expect(music).toBeChecked();
    await user.click(music);
    expect(onUpdate).toHaveBeenCalledWith({
      ...settings,
      ambientMuted: true,
    });

    const cueVolume = screen.getByRole('slider', { name: 'Cue volume' });
    fireEvent.change(cueVolume, {
      target: { value: '35' },
    });
    fireEvent.pointerUp(cueVolume);
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      cueVolumePercent: 35,
    });

    await user.click(
      screen.getByRole('checkbox', { name: 'Mute cues with music' }),
    );
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      cueVolumePercent: 35,
      muteCuesWithMusic: true,
    });
  });

  test('keeps a multi-step volume interaction enabled and saves its latest value', async () => {
    const onUpdate = vi.fn<(value: Settings) => Promise<void>>(() =>
      Promise.resolve(),
    );
    setup({ onUpdate });
    const musicVolume = screen.getByRole('slider', { name: 'Music volume' });

    fireEvent.change(musicVolume, { target: { value: '61' } });
    fireEvent.change(musicVolume, { target: { value: '62' } });
    fireEvent.change(musicVolume, { target: { value: '63' } });
    expect(musicVolume).toBeEnabled();
    expect(musicVolume).toHaveValue('63');
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.pointerUp(musicVolume);
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      ambientVolumePercent: 63,
    });
    await screen.findByText('Audio preferences updated.');

    const cueVolume = screen.getByRole('slider', { name: 'Cue volume' });
    cueVolume.focus();
    fireEvent.keyDown(cueVolume, { key: 'ArrowRight' });
    fireEvent.change(cueVolume, { target: { value: '61' } });
    fireEvent.keyDown(cueVolume, { key: 'ArrowRight' });
    fireEvent.change(cueVolume, { target: { value: '62' } });
    expect(cueVolume).toBeEnabled();
    fireEvent.blur(cueVolume);
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      ambientVolumePercent: 63,
      cueVolumePercent: 62,
    });
  });
  test('updates theme and reduced-motion preferences independently', async () => {
    const user = userEvent.setup();
    const { onUpdate } = setup();

    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    await user.click(screen.getByRole('radio', { name: 'Reduce motion' }));

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    expect(
      screen.getByRole('radiogroup', { name: 'Reduced motion' }),
    ).toBeVisible();

    expect(onUpdate).toHaveBeenNthCalledWith(1, {
      ...settings,
      theme: 'dark',
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      ...settings,
      reducedMotion: 'reduce',
    });
  });

  test('updates blur and brightness without extra appearance controls', () => {
    const { onUpdate } = setup();
    const blur = screen.getByRole('slider', { name: /^Background blur/ });
    const brightness = screen.getByRole('slider', {
      name: /^Background brightness/,
    });

    fireEvent.change(blur, { target: { value: '8' } });
    fireEvent.pointerUp(blur);
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      backgroundBlurPx: 8,
    });

    fireEvent.change(brightness, { target: { value: '125' } });
    fireEvent.blur(brightness);
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...settings,
      backgroundBlurPx: 8,
      backgroundBrightnessPercent: 125,
    });

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  test('uses four icon-led cards without changing existing setting semantics', () => {
    setup();

    expect(
      within(screen.getByRole('radiogroup', { name: 'Theme' })).getByRole(
        'radio',
        { name: 'System' },
      ),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Music on' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cues on' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Pause or resume with Space' }),
    ).toBeChecked();
    for (const name of [
      'Appearance',
      'Audio',
      'Controls',
      'Application data',
    ]) {
      const card = screen.getByRole('group', { name });
      expect(card).toHaveClass('settings-card');
      expect(card.querySelector('.settings-card__icon svg')).not.toBeNull();
      expect(card.querySelector(':scope > legend')).toBeNull();
      expect(
        card.querySelector(':scope > .settings-card__header h3'),
      ).toHaveTextContent(name);
      expect(
        card.querySelector(':scope > .settings-card__divider'),
      ).not.toBeNull();
    }
    expect(screen.queryByRole('group', { name: 'Workflow data' })).toBeNull();
  });

  test('renders accessible theme preview cards with the approved starter backgrounds', () => {
    setup();

    const theme = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(within(theme).getByRole('radio', { name: 'System' })).toBeChecked();
    expect(theme.querySelectorAll('.settings-theme-option')).toHaveLength(3);
    expect(theme.querySelector('.settings-theme-option--system')).toHaveStyle({
      '--settings-theme-preview':
        "url('/seed/backgrounds/mosswood-canopy.webp')",
    });
    expect(theme.querySelector('.settings-theme-option--light')).toHaveStyle({
      '--settings-theme-preview':
        "url('/seed/backgrounds/rainlit-window.webp')",
    });
    expect(theme.querySelector('.settings-theme-option--dark')).toHaveStyle({
      '--settings-theme-preview': "url('/seed/backgrounds/deep-tide.webp')",
    });
  });

  test('disables every slider while a preference update is pending', async () => {
    const user = userEvent.setup();
    let resolveUpdate: (() => void) | undefined;
    const update = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    setup({ onUpdate: () => update });

    await user.click(screen.getByRole('radio', { name: 'Dark' }));

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(4);
    for (const slider of sliders) expect(slider).toBeDisabled();

    await act(async () => {
      resolveUpdate?.();
      await update;
    });

    for (const slider of sliders) expect(slider).toBeEnabled();
  });

  test('uses dedicated Appearance and horizontal Audio compositions', () => {
    setup();

    const appearance = screen.getByRole('group', { name: 'Appearance' });
    const audioGroup = screen.getByRole('group', { name: 'Audio' });
    expect(
      appearance.querySelector('.settings-appearance-grid'),
    ).not.toBeNull();
    expect(
      appearance.querySelector('.settings-appearance-primary'),
    ).not.toBeNull();
    expect(
      appearance.querySelector('.settings-appearance-ranges'),
    ).not.toBeNull();
    expect(audioGroup.querySelector('.settings-audio-rows')).not.toBeNull();
    expect(audioGroup.querySelectorAll('.settings-audio-row')).toHaveLength(3);
    expect(audioGroup.querySelector('.form-grid')).toBeNull();
    expect(
      within(audioGroup).getByRole('checkbox', {
        name: 'Mute cues with music',
      }),
    ).toHaveAccessibleName('Mute cues with music');
    expect(within(audioGroup).getByText('Off')).toBeVisible();
    expect(audioGroup).toHaveClass('settings-card--audio');
  });

  test('places audio feedback in the neutral preferences status area', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('checkbox', { name: 'Music on' }));

    const status = await screen.findByText('Audio preferences updated.');
    expect(status).toHaveTextContent('Audio preferences updated.');
    expect(status.parentElement).toHaveClass('settings-page');
    expect(
      screen.getByRole('group', { name: 'Appearance' }),
    ).not.toContainElement(status);
  });

  test('offers only the Settings package data actions with accurate copy', async () => {
    const user = userEvent.setup();
    const { onExportSettings } = setup();

    expect(
      screen.queryByRole('button', { name: 'Export workflow' }),
    ).toBeNull();
    expect(screen.queryByLabelText('Import workflow file')).toBeNull();
    expect(
      screen.getByText(/Workflows and Assets are not included/u),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Export settings' }));
    expect(await screen.findByText('Settings exported.')).toBeVisible();

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
