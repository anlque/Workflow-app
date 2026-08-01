import { browser } from 'wxt/browser';

import type { SettingsRepository } from '../application/SettingsRepository';

export type SettingsStorageArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
};

export class ChromeSettingsRepository implements SettingsRepository {
  readonly #storage: SettingsStorageArea;

  public constructor(storage: SettingsStorageArea = browser.storage.local) {
    this.#storage = storage;
  }

  public async load(): Promise<unknown> {
    const values = await this.#storage.get('settings');
    return values['settings'];
  }

  public async save(value: unknown): Promise<void> {
    await this.#storage.set({ settings: value });
  }
}
