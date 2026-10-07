import { describe, expect, test, vi } from 'vitest';

import { defaultSettings, type Settings } from '@/features/settings';
import { createAudioSettingsUpdater } from './createAudioSettingsUpdater';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('createAudioSettingsUpdater', () => {
  test('serializes rapid patches so the latest intent wins without reverting another channel', async () => {
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
    const update = createAudioSettingsUpdater({
      load: () => Promise.resolve(current),
      save,
    });

    const first = update({ ambientVolumePercent: 20 });
    const second = update({ cueVolumePercent: 35 });
    const third = update({ ambientVolumePercent: 45 });
    await vi.waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });

    firstSave.resolve();
    await Promise.all([first, second, third]);

    expect(save).toHaveBeenCalledTimes(3);
    expect(current).toMatchObject({
      ambientVolumePercent: 45,
      cueVolumePercent: 35,
    });
  });
});
