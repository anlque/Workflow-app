import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { advanceSessionUseCase } from './advanceSessionUseCase';
import { getActiveSessionUseCase } from './getActiveSessionUseCase';
import { pauseSessionUseCase } from './pauseSessionUseCase';
import { resumeSessionUseCase } from './resumeSessionUseCase';
import { startSessionUseCase } from './startSessionUseCase';
import { stopSessionUseCase } from './stopSessionUseCase';
import { FakeClock } from './testing/FakeClock';
import { InMemorySessionRepository } from './testing/InMemorySessionRepository';

const workflow = () =>
  createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'break', durationSeconds: 5, environment: {} },
    ],
  });

describe('Session use cases', () => {
  test('starts and persists the only active Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);

    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      workflow(),
    );

    expect(started.status).toBe('running');
    await expect(repository.getActive()).resolves.toEqual(started);
  });

  test('rejects starting a second active Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    await startSessionUseCase(repository, clock, 'session-1', workflow());

    await expect(
      startSessionUseCase(repository, clock, 'session-2', workflow()),
    ).rejects.toThrow('An active Session already exists.');
  });

  test('pauses, resumes and stops a persisted Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      workflow(),
    );

    clock.set(3_000);
    const paused = await pauseSessionUseCase(repository, clock, started.id);
    expect(paused.status).toBe('paused');

    clock.set(20_000);
    const resumed = await resumeSessionUseCase(repository, clock, started.id);
    expect(resumed.status).toBe('running');

    clock.set(21_000);
    const stopped = await stopSessionUseCase(repository, clock, started.id);
    expect(stopped.status).toBe('stopped');
    await expect(repository.getActive()).resolves.toBeNull();
  });

  test('advances and persists a Session after a late wake-up', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      workflow(),
    );

    clock.set(12_000);
    const advanced = await advanceSessionUseCase(repository, clock, started.id);

    expect(advanced.status).toBe('running');
    expect(advanced.currentPhaseIndex).toBe(1);
    await expect(repository.get(started.id)).resolves.toEqual(advanced);
  });

  test('returns a reconciled active Session and persists completion', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      workflow(),
    );

    clock.set(30_000);
    const active = await getActiveSessionUseCase(repository, clock);

    expect(active).toBeNull();
    await expect(repository.get(started.id)).resolves.toMatchObject({
      status: 'completed',
    });
  });

  test('rejects a command for a missing Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);

    await expect(
      pauseSessionUseCase(repository, clock, 'missing'),
    ).rejects.toThrow('Session missing was not found.');
  });
});
