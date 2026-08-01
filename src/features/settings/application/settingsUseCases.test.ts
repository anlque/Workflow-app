import { describe, expect, test } from 'vitest';

import { createWorkflowId } from '@/features/workflow';

import type { SettingsRepository } from './SettingsRepository';
import { exportSettingsUseCase } from './exportSettingsUseCase';
import { getSettingsUseCase } from './getSettingsUseCase';
import { importSettingsUseCase } from './importSettingsUseCase';
import { updateSettingsUseCase } from './updateSettingsUseCase';

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
  test('returns defaults when no settings are stored', async () => {
    await expect(
      getSettingsUseCase(new MemorySettingsRepository()),
    ).resolves.toEqual({
      theme: 'system',
      reducedMotion: 'system',
    });
  });

  test('validates and persists updates', async () => {
    const repository = new MemorySettingsRepository();
    const updated = await updateSettingsUseCase(repository, {
      theme: 'dark',
      reducedMotion: 'reduce',
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
    });
    const target = new MemorySettingsRepository();

    const exported = await exportSettingsUseCase(source);
    await importSettingsUseCase(target, exported, { maxFileBytes: 1_024 });

    expect(exported).toBe(
      '{"kind":"flowarium/settings","version":1,"settings":{"theme":"light","reducedMotion":"no-preference"}}',
    );
    expect(target.value).toEqual(source.value);
  });

  test.each([
    [
      'unsupported version',
      '{"kind":"flowarium/settings","version":2,"settings":{}}',
    ],
    [
      'corrupt data',
      '{"kind":"flowarium/settings","version":1,"settings":{"theme":"bad"}}',
    ],
    ['invalid JSON', '{'],
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
