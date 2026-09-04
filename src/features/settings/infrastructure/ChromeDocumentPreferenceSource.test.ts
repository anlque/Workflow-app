import { describe, expect, test, vi } from 'vitest';

import { ChromeSettingsRepository } from './ChromeSettingsRepository';
import {
  ChromeDocumentPreferenceSource,
  type StorageChangeEvent,
} from './ChromeDocumentPreferenceSource';

function createChangeEvent(): StorageChangeEvent & {
  emit(changes: Record<string, { newValue?: unknown }>, area: string): void;
  listenerCount(): number;
} {
  const listeners = new Set<
    (changes: Record<string, { newValue?: unknown }>, area: string) => void
  >();
  return {
    addListener: (listener) => {
      listeners.add(listener);
    },
    removeListener: (listener) => {
      listeners.delete(listener);
    },
    emit: (changes, area) => {
      listeners.forEach((listener) => {
        listener(changes, area);
      });
    },
    listenerCount: () => listeners.size,
  };
}

describe('ChromeDocumentPreferenceSource', () => {
  test('loads the durable settings value', async () => {
    const settings = { theme: 'dark', reducedMotion: 'reduce' };
    const repository = new ChromeSettingsRepository({
      get: vi.fn().mockResolvedValue({ settings }),
      set: vi.fn(),
    });
    const source = new ChromeDocumentPreferenceSource(
      repository,
      createChangeEvent(),
    );
    await expect(source.load()).resolves.toEqual(settings);
  });

  test('emits only local settings changes and supports deletion', () => {
    const event = createChangeEvent();
    const source = new ChromeDocumentPreferenceSource(
      new ChromeSettingsRepository({ get: vi.fn(), set: vi.fn() }),
      event,
    );
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);
    event.emit({ other: { newValue: 1 } }, 'local');
    event.emit({ settings: { newValue: { theme: 'dark' } } }, 'sync');
    event.emit({ settings: { newValue: { theme: 'dark' } } }, 'local');
    event.emit({ settings: {} }, 'local');
    expect(listener.mock.calls).toEqual([[{ theme: 'dark' }], [undefined]]);
    expect(event.listenerCount()).toBe(1);
    unsubscribe();
    expect(event.listenerCount()).toBe(0);
  });
});
