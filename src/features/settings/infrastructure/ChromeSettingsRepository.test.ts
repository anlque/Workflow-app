import { describe, expect, test } from 'vitest';

import {
  ChromeSettingsRepository,
  type SettingsStorageArea,
} from './ChromeSettingsRepository';

class FakeStorageArea implements SettingsStorageArea {
  values: Record<string, unknown> = {};

  public get(key: string): Promise<Record<string, unknown>> {
    return Promise.resolve({ [key]: this.values[key] });
  }

  public set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
    return Promise.resolve();
  }
}

describe('ChromeSettingsRepository', () => {
  test('maps settings to one chrome.storage.local key', async () => {
    const storage = new FakeStorageArea();
    const repository = new ChromeSettingsRepository(storage);
    const settings = { theme: 'dark', reducedMotion: 'reduce' } as const;

    await repository.save(settings);

    expect(storage.values).toEqual({ settings });
    await expect(repository.load()).resolves.toEqual(settings);
  });
});
