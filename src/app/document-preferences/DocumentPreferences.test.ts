import { describe, expect, test, vi } from 'vitest';
import type { DocumentPreferenceSource } from '@/features/settings';
import { createDocumentPreferences } from './DocumentPreferences';

function setup(...values: [] | [unknown]) {
  const initial =
    values.length === 0
      ? { theme: 'dark', reducedMotion: 'reduce' }
      : values[0];
  let storageListener: ((value: unknown) => void) | undefined;
  let mediaListener: (() => void) | undefined;
  const root: { dataset: Record<string, string | undefined> } = {
    dataset: { preferencesReady: 'false' },
  };
  const source: DocumentPreferenceSource = {
    load: vi.fn().mockResolvedValue(initial),
    subscribe(listener) {
      storageListener = listener;
      return () => {
        storageListener = undefined;
      };
    },
  };
  const media = {
    matches: false,
    addEventListener: vi.fn((_type: 'change', listener: () => void) => {
      mediaListener = listener;
    }),
    removeEventListener: vi.fn((_type: 'change', listener: () => void) => {
      if (mediaListener === listener) mediaListener = undefined;
    }),
  };
  const preferences = createDocumentPreferences({ source, root, media });
  return {
    preferences,
    root,
    source,
    media,
    emitStorage: (value: unknown) => storageListener?.(value),
    emitMedia: (matches: boolean) => {
      media.matches = matches;
      mediaListener?.();
    },
    hasStorageListener: () => storageListener !== undefined,
  };
}

describe('createDocumentPreferences', () => {
  test('applies valid settings before revealing the document', async () => {
    const { preferences, root } = setup();
    await preferences.start();
    expect(root.dataset).toMatchObject({
      theme: 'dark',
      reducedMotion: 'reduce',
      preferencesReady: 'true',
    });
    expect(preferences.getSnapshot()).toEqual({
      theme: 'dark',
      reducedMotion: 'reduce',
      effectiveReducedMotion: true,
    });
  });

  test.each([undefined, null, { theme: 'broken' }])(
    'uses defaults for invalid persisted value %#',
    async (value) => {
      const { preferences, root } = setup(value);
      await preferences.start();
      expect(root.dataset).toMatchObject({
        theme: 'system',
        reducedMotion: 'no-preference',
        preferencesReady: 'true',
      });
    },
  );

  test('does not let a stale load replace a newer storage event', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise<unknown>((next) => {
      resolve = next;
    });
    const state = setup();
    vi.mocked(state.source.load).mockReturnValue(pending);
    const started = state.preferences.start();
    state.emitStorage({ theme: 'light', reducedMotion: 'no-preference' });
    resolve({ theme: 'dark', reducedMotion: 'reduce' });
    await started;
    expect(state.preferences.getSnapshot().theme).toBe('light');
  });

  test('tracks system motion and removes all listeners on disposal', async () => {
    const state = setup({ theme: 'system', reducedMotion: 'system' });
    const listener = vi.fn();
    state.preferences.subscribe(listener);
    await state.preferences.start();
    state.emitMedia(true);
    expect(state.preferences.getSnapshot().effectiveReducedMotion).toBe(true);
    expect(state.root.dataset['reducedMotion']).toBe('reduce');
    state.preferences.dispose();
    expect(state.hasStorageListener()).toBe(false);
    expect(state.media.removeEventListener).toHaveBeenCalledOnce();
    state.emitMedia(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('reveals defaults when the initial storage read fails', async () => {
    const state = setup();
    vi.mocked(state.source.load).mockRejectedValue(new Error('unavailable'));
    await expect(state.preferences.start()).resolves.toBeUndefined();
    expect(state.root.dataset).toMatchObject({
      theme: 'system',
      reducedMotion: 'no-preference',
      preferencesReady: 'true',
    });
  });
});
