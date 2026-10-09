import { describe, expect, test, vi } from 'vitest';

import { defaultSettings, type Settings } from '@/features/settings';
import { createSettingsUpdater } from './createSettingsUpdater';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('createSettingsUpdater', () => {
  test('serializes rapid patches so latest intent wins without reverting unrelated preferences', async () => {
    let current: Settings = defaultSettings;
    const firstSave = createDeferred();
    const save = vi
      .fn<(settings: Settings) => Promise<void>>()
      .mockImplementationOnce(async (settings) => {
        await firstSave.promise;
        current = settings;
      })
      .mockImplementation((settings) => {
        current = settings;
        return Promise.resolve();
      });
    const update = createSettingsUpdater({
      load: () => Promise.resolve(current),
      save,
    });

    const first = update({ ambientVolumePercent: 20 });
    const second = update({ backgroundBlurPx: 12 });
    const third = update({ theme: 'dark' });
    const fourth = update({ ambientVolumePercent: 45 });
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });

    firstSave.resolve();
    await Promise.all([first, second, third, fourth]);

    expect(save).toHaveBeenCalledTimes(4);
    expect(current).toMatchObject({
      ambientVolumePercent: 45,
      backgroundBlurPx: 12,
      theme: 'dark',
    });
  });

  test('continues the queue after a rejected update', async () => {
    let current: Settings = defaultSettings;
    const save = vi
      .fn<(settings: Settings) => Promise<void>>()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockImplementation((settings) => {
        current = settings;
        return Promise.resolve();
      });
    const update = createSettingsUpdater({
      load: () => Promise.resolve(current),
      save,
    });

    await expect(update({ backgroundBlurPx: 12 })).rejects.toThrow(
      'unavailable',
    );
    await expect(update({ backgroundBlurPx: 8 })).resolves.toBeUndefined();
    expect(current.backgroundBlurPx).toBe(8);
  });
});
