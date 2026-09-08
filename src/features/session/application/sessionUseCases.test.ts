import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { advanceSessionUseCase } from './advanceSessionUseCase';
import { continueRewardSessionUseCase } from './continueRewardSessionUseCase';
import { getActiveSessionUseCase } from './getActiveSessionUseCase';
import { pauseSessionUseCase } from './pauseSessionUseCase';
import { resumeSessionUseCase } from './resumeSessionUseCase';
import { startSessionUseCase } from './startSessionUseCase';
import type { SessionWorkflowResolver } from './SessionWorkflowResolver';
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
  test('resolves Workflow Asset references before creating the snapshot', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const source = createWorkflow({
      id: 'workflow-role',
      name: 'Role workflow',
      phases: [
        {
          type: 'focus',
          durationSeconds: 10,
          environment: { audioAsset: { type: 'role', role: 'Ambient' } },
        },
      ],
    });
    const resolved = createWorkflow({
      id: source.id,
      name: source.name,
      phases: [
        {
          type: 'focus',
          durationSeconds: 10,
          environment: { audioAsset: { type: 'direct', assetId: 'audio-1' } },
        },
      ],
    });

    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      source,
      { resolve: () => Promise.resolve(resolved) },
    );

    expect(started.snapshot.workflow).toEqual(resolved);
    expect(started.snapshot.workflow).not.toBe(resolved);
  });

  test('resolves before save and performs zero writes when resolution fails', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const events: string[] = [];
    const save = vi.spyOn(repository, 'save').mockImplementation((session) => {
      events.push(`save:${session.snapshot.workflow.name}`);
      return Promise.resolve();
    });
    const source = workflow();

    await startSessionUseCase(repository, clock, 'session-1', source, {
      resolve: (value) => {
        events.push(`resolve:${value.name}`);
        return Promise.resolve(value);
      },
    });

    expect(events).toEqual(['resolve:Deep work', 'save:Deep work']);
    save.mockClear();
    await expect(
      startSessionUseCase(repository, clock, 'session-2', source, {
        resolve: () => Promise.reject(new Error('Role missing')),
      }),
    ).rejects.toThrow('Role missing');
    expect(save).not.toHaveBeenCalled();
  });

  test('keeps the resolved snapshot unchanged after the Role owner moves', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const source = createWorkflow({
      id: 'workflow-role',
      name: 'Role workflow',
      phases: [
        {
          type: 'focus',
          durationSeconds: 10,
          environment: { audioAsset: { type: 'role', role: 'Ambient' } },
        },
      ],
    });
    let owner = 'audio-1';
    const resolver: SessionWorkflowResolver = {
      resolve: () =>
        Promise.resolve(
          createWorkflow({
            id: source.id,
            name: source.name,
            phases: [
              {
                type: 'focus',
                durationSeconds: 10,
                environment: { audioAsset: { type: 'direct', assetId: owner } },
              },
            ],
          }),
        ),
    };

    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      source,
      resolver,
    );
    owner = 'audio-2';
    const futureResolution = await resolver.resolve(source);

    expect(futureResolution.phases[0].environment.audioAsset).toEqual({
      type: 'direct',
      assetId: 'audio-2',
    });
    expect(started.snapshot.workflow.phases[0].environment.audioAsset).toEqual({
      type: 'direct',
      assetId: 'audio-1',
    });
    await expect(repository.getActive()).resolves.toEqual(started);
  });
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

  test('returns and persists a transitioning Session as active', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    await startSessionUseCase(repository, clock, 'session-1', workflow());

    clock.set(11_500);
    const active = await getActiveSessionUseCase(repository, clock);

    expect(active).toMatchObject({
      status: 'transitioning',
      currentPhaseIndex: 0,
      transitionEndsAt: 12_000,
    });
    await expect(repository.getActive()).resolves.toEqual(active);
  });

  test('rejects a command for a missing Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);

    await expect(
      pauseSessionUseCase(repository, clock, 'missing'),
    ).rejects.toThrow('Session missing was not found.');
  });

  test('continues and persists only a Reward-paused Session', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const rewarded = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Rewarded work',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const started = await startSessionUseCase(
      repository,
      clock,
      'session-1',
      rewarded,
    );
    clock.set(12_000);
    await advanceSessionUseCase(repository, clock, started.id);

    clock.set(20_000);
    const continued = await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
    );

    expect(continued).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 20_000,
      phaseEndsAt: 25_000,
    });
    await expect(repository.get(started.id)).resolves.toEqual(continued);
  });
});
