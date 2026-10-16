import { describe, expect, test, vi } from 'vitest';

import type { StarterContentSeedVersion } from '@/features/starter-content';

import { initializeBackground } from './bootstrapBackground';

const seedOne: StarterContentSeedVersion = {
  version: 1,
  assets: [],
  workflows: [],
};
const seedTwo: StarterContentSeedVersion = {
  version: 2,
  assets: [],
  workflows: [],
};

function deferred(): Readonly<{
  promise: Promise<void>;
  reject(error: Error): void;
  resolve(): void;
}> {
  let reject: (error: Error) => void = () => undefined;
  let resolve = (): void => undefined;
  const promise = new Promise<void>((complete, fail) => {
    reject = fail;
    resolve = complete;
  });
  return { promise, reject, resolve };
}

describe('initializeBackground', () => {
  test('registers listeners synchronously, seeds in order and restores before readiness', async () => {
    const operations: string[] = ['database'];
    const seedGate = deferred();
    let runWhenReady:
      | (<Result>(operation: () => Promise<Result>) => Promise<Result>)
      | undefined;

    const initialization = initializeBackground({
      registerListeners(run) {
        operations.push('listeners');
        runWhenReady = run;
      },
      seeds: [seedTwo, seedOne],
      seed: vi.fn(async ({ version }) => {
        operations.push(`seed:${String(version)}`);
        if (version === 1) await seedGate.promise;
      }),
      restoreCoordinator: vi.fn(() => {
        operations.push('restore');
        return Promise.resolve();
      }),
    });
    expect(operations).toEqual(['database', 'listeners', 'seed:1']);
    if (runWhenReady === undefined) throw new Error('Listeners were not set.');

    const handled = runWhenReady(() => {
      operations.push('event');
      return Promise.resolve('handled');
    });
    await Promise.resolve();
    expect(operations).not.toContain('event');

    seedGate.resolve();
    await expect(initialization).resolves.toBeUndefined();
    await expect(handled).resolves.toBe('handled');

    expect(operations).toEqual([
      'database',
      'listeners',
      'seed:1',
      'seed:2',
      'restore',
      'event',
    ]);
  });

  test('rejects a waiting event when seeding fails without restoring or running it', async () => {
    const seedGate = deferred();
    const restoreCoordinator = vi.fn(() => Promise.resolve());
    const dependentOperation = vi.fn(() => Promise.resolve());
    let runWhenReady:
      | (<Result>(operation: () => Promise<Result>) => Promise<Result>)
      | undefined;

    const initialization = initializeBackground({
      registerListeners(run) {
        runWhenReady = run;
      },
      seeds: [seedOne],
      seed: () => seedGate.promise,
      restoreCoordinator,
    });
    if (runWhenReady === undefined) throw new Error('Listeners were not set.');
    const waiting = runWhenReady(dependentOperation);
    seedGate.reject(new Error('seed failed'));

    await expect(initialization).rejects.toThrow('seed failed');
    await expect(waiting).rejects.toThrow('seed failed');
    expect(restoreCoordinator).not.toHaveBeenCalled();
    expect(dependentOperation).not.toHaveBeenCalled();
  });
});
