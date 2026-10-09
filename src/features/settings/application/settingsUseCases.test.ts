import { describe, expect, test } from 'vitest';

import { createWorkflowId } from '@/features/workflow';
import {
  createSettings,
  defaultSettings,
  effectiveAmbientVolume,
  effectiveCueVolume,
} from '../domain/Settings';

import type { SettingsRepository } from './SettingsRepository';
import { exportSettingsUseCase } from './exportSettingsUseCase';
import { getSettingsUseCase } from './getSettingsUseCase';
import { importSettingsUseCase } from './importSettingsUseCase';
import { updateSettingsUseCase } from './updateSettingsUseCase';
import type { SettingsPackageV2 } from './SettingsPackage';

class MemorySettingsRepository implements SettingsRepository {
  value: unknown;
  writes = 0;

  public constructor(value?: unknown) {
    this.value = value;
  }

  public load(): Promise<unknown> {
    return Promise.resolve(this.value);
  }

  public save(value: unknown): Promise<void> {
    this.writes += 1;
    this.value = value;
    return Promise.resolve();
  }
}

describe('Settings use cases', () => {
  test('keeps ambient and cue mute semantics independent unless coupled', () => {
    const musicMuted = { ...defaultSettings, ambientMuted: true };
    expect(effectiveAmbientVolume(musicMuted)).toBe(0);
    expect(effectiveCueVolume(musicMuted)).toBe(1);
    expect(effectiveCueVolume({ ...musicMuted, muteCuesWithMusic: true })).toBe(
      0,
    );
    expect(effectiveCueVolume({ ...defaultSettings, cuesMuted: true })).toBe(0);
  });

  test('returns defaults when no settings are stored', async () => {
    await expect(
      getSettingsUseCase(new MemorySettingsRepository()),
    ).resolves.toEqual({
      theme: 'system',
      reducedMotion: 'system',
      ambientVolumePercent: 100,
      ambientMuted: false,
      cueVolumePercent: 100,
      cuesMuted: false,
      muteCuesWithMusic: false,
      backgroundBlurPx: 0,
      backgroundBrightnessPercent: 100,
    });
  });

  test('migrates a legacy shared volume into both independent channels', async () => {
    await expect(
      getSettingsUseCase(
        new MemorySettingsRepository({
          theme: 'dark',
          reducedMotion: 'reduce',
          volumePercent: 35,
        }),
      ),
    ).resolves.toEqual({
      theme: 'dark',
      reducedMotion: 'reduce',
      ambientVolumePercent: 35,
      ambientMuted: false,
      cueVolumePercent: 35,
      cuesMuted: false,
      muteCuesWithMusic: false,
      backgroundBlurPx: 0,
      backgroundBrightnessPercent: 100,
    });
  });

  test('validates and persists updates', async () => {
    const repository = new MemorySettingsRepository();
    const updated = await updateSettingsUseCase(repository, {
      theme: 'dark',
      reducedMotion: 'reduce',
      ambientVolumePercent: 25,
      ambientMuted: true,
      cueVolumePercent: 60,
      cuesMuted: false,
      muteCuesWithMusic: true,
      backgroundBlurPx: 24,
      backgroundBrightnessPercent: 150,
      lastSelectedWorkflowId: createWorkflowId('workflow-1'),
    });

    expect(repository.value).toEqual(updated);
    await expect(
      updateSettingsUseCase(repository, {
        theme: 'midnight',
        reducedMotion: 'reduce',
      }),
    ).rejects.toThrow('Settings are invalid.');
  });

  test('exports deterministic versioned settings and imports them', async () => {
    const source = new MemorySettingsRepository({
      theme: 'light',
      reducedMotion: 'no-preference',
      ambientVolumePercent: 40,
      ambientMuted: false,
      cueVolumePercent: 70,
      cuesMuted: true,
      muteCuesWithMusic: false,
      backgroundBlurPx: 12,
      backgroundBrightnessPercent: 85,
    });
    const target = new MemorySettingsRepository();

    const exported = await exportSettingsUseCase(source);
    await importSettingsUseCase(target, exported, { maxFileBytes: 1_024 });

    expect(exported).toBe(
      '{"kind":"locusora/settings","version":3,"settings":{"theme":"light","reducedMotion":"no-preference","ambientVolumePercent":40,"ambientMuted":false,"cueVolumePercent":70,"cuesMuted":true,"muteCuesWithMusic":false,"backgroundBlurPx":12,"backgroundBrightnessPercent":85}}',
    );
    expect(target.value).toEqual({
      theme: 'light',
      reducedMotion: 'no-preference',
      ambientVolumePercent: 40,
      ambientMuted: false,
      cueVolumePercent: 70,
      cuesMuted: true,
      muteCuesWithMusic: false,
      backgroundBlurPx: 12,
      backgroundBrightnessPercent: 85,
    });
  });

  test('imports a legacy v1 package with canonical audio defaults', async () => {
    const target = new MemorySettingsRepository();

    await importSettingsUseCase(
      target,
      '{"kind":"locusora/settings","version":1,"settings":{"theme":"light","reducedMotion":"no-preference"}}',
      { maxFileBytes: 1_024 },
    );

    expect(target.value).toMatchObject({
      ambientVolumePercent: 100,
      ambientMuted: false,
      cueVolumePercent: 100,
      cuesMuted: false,
      muteCuesWithMusic: false,
      backgroundBlurPx: 0,
      backgroundBrightnessPercent: 100,
    });
  });

  test('imports a v2 package with appearance defaults', async () => {
    const packageV2 = {
      kind: 'locusora/settings',
      version: 2,
      settings: {
        theme: 'dark',
        reducedMotion: 'reduce',
        ambientVolumePercent: 20,
        ambientMuted: true,
        cueVolumePercent: 80,
        cuesMuted: false,
        muteCuesWithMusic: true,
      },
    } satisfies SettingsPackageV2;
    const target = new MemorySettingsRepository();

    await importSettingsUseCase(target, JSON.stringify(packageV2), {
      maxFileBytes: 1_024,
    });

    expect(target.value).toMatchObject({
      backgroundBlurPx: 0,
      backgroundBrightnessPercent: 100,
    });

    const invalidV2: SettingsPackageV2 = {
      ...packageV2,
      settings: {
        ...packageV2.settings,
        // @ts-expect-error v3 appearance fields are not part of the v2 wire format.
        backgroundBlurPx: 0,
        backgroundBrightnessPercent: 100,
      },
    };
    await expect(
      importSettingsUseCase(target, JSON.stringify(invalidV2), {
        maxFileBytes: 1_024,
      }),
    ).rejects.toThrow('Settings package is invalid.');
  });

  test.each([
    { backgroundBlurPx: 0, backgroundBrightnessPercent: 50 },
    { backgroundBlurPx: 24, backgroundBrightnessPercent: 150 },
  ])('accepts appearance boundaries', (appearance) => {
    expect(
      createSettings({
        ...defaultSettings,
        ...appearance,
      }),
    ).toMatchObject(appearance);
  });

  test.each([
    ['negative blur', { backgroundBlurPx: -1 }],
    ['oversized blur', { backgroundBlurPx: 25 }],
    ['fractional blur', { backgroundBlurPx: 1.5 }],
    ['low brightness', { backgroundBrightnessPercent: 45 }],
    ['high brightness', { backgroundBrightnessPercent: 155 }],
    ['unaligned brightness', { backgroundBrightnessPercent: 101 }],
  ])('rejects %s', (_case, patch) => {
    expect(() => createSettings({ ...defaultSettings, ...patch })).toThrow(
      'Settings are invalid.',
    );
  });

  test('rejects a partial appearance group', () => {
    const partial: Record<string, unknown> = { ...defaultSettings };
    delete partial['backgroundBrightnessPercent'];
    expect(() => createSettings(partial)).toThrow('Settings are invalid.');
  });

  test('rejects the removed effect field', () => {
    const removedField = ['ambient', 'Effect'].join('');
    expect(() =>
      createSettings({ ...defaultSettings, [removedField]: 'removed' }),
    ).toThrow('Settings are invalid.');
  });

  test('returns a frozen canonical value', () => {
    expect(Object.isFrozen(createSettings(defaultSettings))).toBe(true);
  });

  test.each([
    [
      'unsupported version',
      '{"kind":"locusora/settings","version":4,"settings":{}}',
    ],
    [
      'corrupt data',
      '{"kind":"locusora/settings","version":1,"settings":{"theme":"bad"}}',
    ],
    ['invalid JSON', '{'],
    [
      'partial canonical audio settings',
      '{"kind":"locusora/settings","version":2,"settings":{"theme":"light","reducedMotion":"reduce","ambientVolumePercent":50}}',
    ],
    [
      'legacy shape in v2',
      '{"kind":"locusora/settings","version":2,"settings":{"theme":"light","reducedMotion":"reduce"}}',
    ],
    [
      'canonical shape in v1',
      '{"kind":"locusora/settings","version":1,"settings":{"theme":"light","reducedMotion":"reduce","ambientVolumePercent":50,"ambientMuted":false,"cueVolumePercent":50,"cuesMuted":false,"muteCuesWithMusic":false}}',
    ],
    [
      'v2 appearance fields',
      '{"kind":"locusora/settings","version":2,"settings":{"theme":"light","reducedMotion":"reduce","ambientVolumePercent":50,"ambientMuted":false,"cueVolumePercent":50,"cuesMuted":false,"muteCuesWithMusic":false,"backgroundBlurPx":0,"backgroundBrightnessPercent":100}}',
    ],
    [
      'partial v3 appearance',
      '{"kind":"locusora/settings","version":3,"settings":{"theme":"light","reducedMotion":"reduce","ambientVolumePercent":50,"ambientMuted":false,"cueVolumePercent":50,"cuesMuted":false,"muteCuesWithMusic":false,"backgroundBlurPx":0}}',
    ],
  ])('rejects %s without writes', async (_case, data) => {
    const repository = new MemorySettingsRepository();

    await expect(
      importSettingsUseCase(repository, data, { maxFileBytes: 1_024 }),
    ).rejects.toThrow();
    expect(repository.writes).toBe(0);
  });

  test('rejects oversized settings files before parsing or writing', async () => {
    const repository = new MemorySettingsRepository();

    await expect(
      importSettingsUseCase(repository, '{}', { maxFileBytes: 1 }),
    ).rejects.toThrow(
      'Settings package exceeds the configured file size limit.',
    );
    expect(repository.writes).toBe(0);
  });
});
