import { describe, expect, test, vi } from 'vitest';

import {
  createWorkflow,
  resolveWorkflowAssetReferences,
} from '@/features/workflow';
import { createAssetId } from '@/features/assets';

import { advanceSessionUseCase } from './advanceSessionUseCase';
import { continueRewardSessionUseCase } from './continueRewardSessionUseCase';
import { getActiveSessionUseCase } from './getActiveSessionUseCase';
import { pauseSessionUseCase } from './pauseSessionUseCase';
import { resumeSessionUseCase } from './resumeSessionUseCase';
import { restartSessionPhaseUseCase } from './restartSessionPhaseUseCase';
import { restartSessionWorkflowUseCase } from './restartSessionWorkflowUseCase';
import { rollSessionRewardUseCase } from './rollSessionRewardUseCase';
import { skipSessionPhaseUseCase } from './skipSessionPhaseUseCase';
import { skipSessionRewardUseCase } from './skipSessionRewardUseCase';
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

const restartBonusWorkflow = (final = false) =>
  createWorkflow({
    id: final ? 'restart-final-bonus-workflow' : 'restart-bonus-workflow',
    name: 'Restart Bonus',
    phases: final
      ? [{ type: 'focus', durationSeconds: 1, environment: {} }]
      : [
          { type: 'focus', durationSeconds: 1, environment: {} },
          { type: 'break', durationSeconds: 1, environment: {} },
        ],
    rewardDice: {
      frequency: 1,
      sides: [
        {
          icon: 'a',
          title: 'A',
          bonusPhase: {
            name: 'Bonus',
            durationSeconds: 30,
            environment: {},
          },
        },
        { icon: 'b', title: 'B' },
      ],
    },
  });

describe('Session use cases', () => {
  test('materializes a Quick Workflow into an immutable mode-free Session snapshot', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const quick = createWorkflow({
      mode: 'quick',
      id: 'quick-session',
      name: 'Quick',
      configuration: {
        cycleCount: 3,
        focus: {
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Focus image' },
            audioAsset: { type: 'role', role: 'Focus audio' },
          },
        },
        shortBreak: {
          durationSeconds: 30,
          environment: { audioAsset: { type: 'role', role: 'Short audio' } },
        },
        longBreak: {
          durationSeconds: 90,
          environment: {
            backgroundAsset: { type: 'role', role: 'Long image' },
          },
          frequency: 2,
        },
        rewardDice: {
          frequency: 2,
          sides: [
            { icon: 'a', title: 'A' },
            { icon: 'b', title: 'B' },
          ],
        },
      },
    });
    const started = await startSessionUseCase(
      repository,
      clock,
      'quick-session-1',
      quick,
      {
        resolve: (source) =>
          resolveWorkflowAssetReferences(source, {
            resolve: (role, kind) =>
              Promise.resolve(
                createAssetId(
                  `${kind}-${role.toLowerCase().replaceAll(' ', '-')}`,
                ),
              ),
          }),
      },
    );
    expect(started.snapshot.workflow).not.toHaveProperty('mode');
    expect(started.snapshot.workflow.phases.map(({ name }) => name)).toEqual([
      'Focus',
      'Short break',
      'Focus',
      'Long break',
      'Focus',
      'Short break',
    ]);
    expect(started.snapshot.workflow.phases[0].environment.audioAsset).toEqual({
      type: 'direct',
      assetId: 'audio-focus-audio',
    });
    expect(
      started.snapshot.workflow.phases[0].environment.backgroundAsset,
    ).toEqual({ type: 'direct', assetId: 'image-focus-image' });
    expect(started.snapshot.workflow.phases[1]?.environment.audioAsset).toEqual(
      { type: 'direct', assetId: 'audio-short-audio' },
    );
    expect(
      started.snapshot.workflow.phases[3]?.environment.backgroundAsset,
    ).toEqual({ type: 'direct', assetId: 'image-long-image' });
    expect(Object.isFrozen(started.snapshot.workflow.phases)).toBe(true);
    expect(started.snapshot.workflow).not.toHaveProperty('configuration');
  });

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

    expect(started.snapshot.workflow).toEqual({
      id: resolved.id,
      name: resolved.name,
      phases: resolved.phases,
    });
    expect(started.snapshot.workflow).not.toHaveProperty('mode');
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

  test('pauses and resumes the normal continuation after a non-final Bonus', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'normal-after-bonus-session',
      restartBonusWorkflow(),
    );
    clock.set(3_000);
    await advanceSessionUseCase(repository, clock, started.id);
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'roll-normal-after-bonus',
      'normal-after-bonus-session:0',
    );
    await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'continue-normal-after-bonus',
      'normal-after-bonus-session:0',
    );
    clock.set(33_000);
    await advanceSessionUseCase(repository, clock, started.id);
    clock.set(33_500);

    const paused = await pauseSessionUseCase(repository, clock, started.id);
    expect(paused).toMatchObject({
      status: 'paused',
      pauseReason: 'user',
      currentPhaseIndex: 1,
      rewardRitual: { acknowledged: true },
    });
    expect(paused).not.toHaveProperty('activeBonusPhase');

    clock.set(34_000);
    await expect(
      resumeSessionUseCase(repository, clock, started.id),
    ).resolves.toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      rewardRitual: { acknowledged: true },
    });
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
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'roll-1',
      'session-1:0',
    );

    clock.set(20_000);
    const continued = await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'continue-1',
      'session-1:0',
    );

    expect(continued).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 20_000,
      phaseEndsAt: 25_000,
    });
    await expect(repository.get(started.id)).resolves.toEqual(continued);
  });

  test('deduplicates Continue after restart without another write', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const rewarded = createWorkflow({
      id: 'final-reward',
      name: 'Final reward',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'a', title: 'A' },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const started = await startSessionUseCase(
      repository,
      clock,
      'continue-retry',
      rewarded,
    );
    clock.set(3_000);
    await advanceSessionUseCase(repository, clock, started.id);
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'roll-1',
      'continue-retry:0',
    );
    const completed = await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'continue-1',
      'continue-retry:0',
    );
    const save = vi.spyOn(repository, 'save');

    const retried = await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'continue-1',
      'continue-retry:0',
    );

    expect(retried).toEqual(completed);
    expect(save).not.toHaveBeenCalled();

    const random = vi.fn(() => 0.99);
    const oldRollRetry = await rollSessionRewardUseCase(
      repository,
      started.id,
      random,
      false,
      'roll-1',
      'continue-retry:0',
    );
    expect(oldRollRetry).toEqual(completed);
    expect(random).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects command-id collisions and stale Reward opportunities without writes', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const rewarded = createWorkflow({
      id: 'fingerprint-workflow',
      name: 'Fingerprint',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        rerolls: 3,
        sides: [
          { icon: 'a', title: 'A' },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const started = await startSessionUseCase(
      repository,
      clock,
      'fingerprint-session',
      rewarded,
    );
    clock.set(3_000);
    await advanceSessionUseCase(repository, clock, started.id);
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'shared-id',
      'fingerprint-session:0',
    );
    const save = vi.spyOn(repository, 'save');
    const random = vi.fn(() => 0.5);

    await expect(
      rollSessionRewardUseCase(
        repository,
        started.id,
        random,
        true,
        'shared-id',
        'fingerprint-session:0',
      ),
    ).rejects.toThrow(
      'Reward command identifier conflicts with an earlier command.',
    );
    await expect(
      rollSessionRewardUseCase(
        repository,
        started.id,
        random,
        true,
        'evicted-id',
        'fingerprint-session:previous',
      ),
    ).rejects.toThrow(
      'Reward command does not match the current Reward opportunity.',
    );
    expect(random).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  test('restarts a Bonus once and deduplicates the persisted command fingerprint', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const rewarded = restartBonusWorkflow();
    const started = await startSessionUseCase(
      repository,
      clock,
      'restart-bonus-session',
      rewarded,
    );
    clock.set(3_000);
    await advanceSessionUseCase(repository, clock, started.id);
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'roll-restart',
      'restart-bonus-session:0',
    );
    await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'continue-restart',
      'restart-bonus-session:0',
    );
    clock.set(10_000);
    const restarted = await restartSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'restart-1',
      { type: 'bonus', rewardRitualId: 'restart-bonus-session:0' },
    );
    expect(restarted).toMatchObject({ phaseEndsAt: 40_000 });

    const save = vi.spyOn(repository, 'save');
    await expect(
      restartSessionPhaseUseCase(repository, clock, started.id, 'restart-1', {
        type: 'bonus',
        rewardRitualId: 'restart-bonus-session:0',
      }),
    ).resolves.toEqual(restarted);
    await expect(
      restartSessionPhaseUseCase(
        repository,
        clock,
        started.id,
        'continue-restart',
        { type: 'bonus', rewardRitualId: 'restart-bonus-session:0' },
      ),
    ).rejects.toThrow();
    await expect(
      restartSessionPhaseUseCase(
        repository,
        clock,
        started.id,
        'restart-stale',
        {
          type: 'bonus',
          rewardRitualId: 'restart-bonus-session:previous',
        },
      ),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  test.each([
    ['non-final', 33_000, false],
    ['non-final', 34_000, false],
    ['final', 33_000, true],
    ['final', 34_000, true],
  ] as const)(
    'rejects %s Bonus Restart at %i with zero writes',
    async (_kind, now, final) => {
      const repository = new InMemorySessionRepository();
      const clock = new FakeClock(1_000);
      const started = await startSessionUseCase(
        repository,
        clock,
        `expired-bonus-${String(now)}`,
        restartBonusWorkflow(final),
      );
      clock.set(3_000);
      await advanceSessionUseCase(repository, clock, started.id);
      await rollSessionRewardUseCase(
        repository,
        started.id,
        () => 0,
        false,
        `roll-${String(now)}`,
        `${started.id}:0`,
      );
      await continueRewardSessionUseCase(
        repository,
        clock,
        started.id,
        `continue-${String(now)}`,
        `${started.id}:0`,
      );
      clock.set(now);
      const before = await repository.get(started.id);
      const save = vi.spyOn(repository, 'save');

      await expect(
        restartSessionPhaseUseCase(
          repository,
          clock,
          started.id,
          `restart-${String(now)}`,
          { type: 'bonus', rewardRitualId: `${started.id}:0` },
        ),
      ).rejects.toThrow();
      expect(save).not.toHaveBeenCalled();
      await expect(repository.get(started.id)).resolves.toEqual(before);
    },
  );

  test('reconciles an exact persisted Restart retry without adding another receipt', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'durable-restart-session',
      restartBonusWorkflow(),
    );
    clock.set(3_000);
    await advanceSessionUseCase(repository, clock, started.id);
    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'durable-roll',
      'durable-restart-session:0',
    );
    await continueRewardSessionUseCase(
      repository,
      clock,
      started.id,
      'durable-continue',
      'durable-restart-session:0',
    );
    clock.set(10_000);
    await restartSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'durable-restart',
      { type: 'bonus', rewardRitualId: 'durable-restart-session:0' },
    );
    clock.set(40_000);

    const reconciled = await restartSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'durable-restart',
      { type: 'bonus', rewardRitualId: 'durable-restart-session:0' },
    );

    expect(reconciled).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseEndsAt: 40_000,
    });
    expect(
      reconciled.restartCommandReceipts.filter(
        ({ commandId }) => commandId === 'durable-restart',
      ),
    ).toHaveLength(1);
    await expect(repository.get(started.id)).resolves.toEqual(reconciled);
  });

  test('restarts a normal Phase and the Workflow with one write each', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'restart-normal-session',
      workflow(),
    );
    clock.set(5_000);
    const save = vi.spyOn(repository, 'save');
    const now = vi.spyOn(clock, 'now');

    const phase = await restartSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'restart-normal',
      { type: 'phase', phaseIndex: 0 },
    );
    expect(phase).toMatchObject({ phaseStartedAt: 5_000, phaseEndsAt: 15_000 });

    clock.set(6_000);
    const complete = await restartSessionWorkflowUseCase(
      repository,
      clock,
      started.id,
      'restart-workflow',
    );
    expect(complete).toMatchObject({
      id: started.id,
      currentPhaseIndex: 0,
      phaseStartedAt: 6_000,
      phaseEndsAt: 16_000,
      rewardCommandReceipts: [],
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(now).toHaveBeenCalledTimes(2);

    save.mockClear();
    clock.set(30_000);
    await expect(
      restartSessionWorkflowUseCase(
        repository,
        clock,
        started.id,
        'restart-workflow',
      ),
    ).resolves.toEqual(complete);
    expect(save).not.toHaveBeenCalled();
  });

  test('rejects Reward commands that reuse a restart command ID with zero writes', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'shared-command-namespace',
      restartBonusWorkflow(),
    );
    await restartSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'restart-owned-id',
      { type: 'phase', phaseIndex: 0 },
    );
    clock.set(3_000);
    const rewardPaused = await advanceSessionUseCase(
      repository,
      clock,
      started.id,
    );
    const save = vi.spyOn(repository, 'save');
    const random = vi.fn(() => 0);

    await expect(
      rollSessionRewardUseCase(
        repository,
        started.id,
        random,
        false,
        'restart-owned-id',
        'shared-command-namespace:0',
      ),
    ).rejects.toThrow('Reward command identifier conflicts');
    expect(random).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    await expect(repository.get(started.id)).resolves.toEqual(rewardPaused);

    await rollSessionRewardUseCase(
      repository,
      started.id,
      () => 0,
      false,
      'new-roll-id',
      'shared-command-namespace:0',
    );
    save.mockClear();
    const selected = await repository.get(started.id);
    await expect(
      continueRewardSessionUseCase(
        repository,
        clock,
        started.id,
        'restart-owned-id',
        'shared-command-namespace:0',
      ),
    ).rejects.toThrow('Reward command identifier conflicts');
    expect(save).not.toHaveBeenCalled();
    await expect(repository.get(started.id)).resolves.toEqual(selected);
  });

  test('skips an exact Phase with one clock sample and one write while duplicates and stale targets write nothing', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(2_000);
    const started = await startSessionUseCase(
      repository,
      new FakeClock(1_000),
      'skip-phase-use-case',
      workflow(),
    );
    const now = vi.spyOn(clock, 'now');
    const save = vi.spyOn(repository, 'save');

    const skipped = await skipSessionPhaseUseCase(
      repository,
      clock,
      started.id,
      'skip-phase-command',
      { type: 'phase', phaseIndex: 0 },
    );

    expect(skipped).toMatchObject({
      status: 'transitioning',
      transitionEndsAt: 3_000,
    });
    expect(now).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);

    save.mockClear();
    now.mockClear();
    await expect(
      skipSessionPhaseUseCase(
        repository,
        clock,
        started.id,
        'skip-phase-command',
        { type: 'phase', phaseIndex: 0 },
      ),
    ).resolves.toBe(skipped);
    expect(now).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();

    const staleRepository = new InMemorySessionRepository();
    const staleStarted = await startSessionUseCase(
      staleRepository,
      new FakeClock(1_000),
      'skip-stale-use-case',
      workflow(),
    );
    const staleSave = vi.spyOn(staleRepository, 'save');
    await expect(
      skipSessionPhaseUseCase(
        staleRepository,
        new FakeClock(11_000),
        staleStarted.id,
        'skip-at-deadline',
        { type: 'phase', phaseIndex: 0 },
      ),
    ).rejects.toThrow();
    expect(staleSave).not.toHaveBeenCalled();
  });

  test('skips only an unrolled Reward with one write and preserves storage on rejection', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'skip-reward-use-case',
      restartBonusWorkflow(),
    );
    clock.set(3_000);
    const paused = await advanceSessionUseCase(repository, clock, started.id);
    if (paused.rewardRitual === undefined)
      throw new Error('Expected Reward pause.');
    const save = vi.spyOn(repository, 'save');

    const skipped = await skipSessionRewardUseCase(
      repository,
      clock,
      started.id,
      'skip-reward-command',
      paused.rewardRitual.id,
    );
    expect(skipped).toMatchObject({ status: 'running', currentPhaseIndex: 1 });
    expect(save).toHaveBeenCalledTimes(1);

    save.mockClear();
    await expect(
      skipSessionRewardUseCase(
        repository,
        clock,
        started.id,
        'skip-reward-command',
        paused.rewardRitual.id,
      ),
    ).resolves.toBe(skipped);
    expect(save).not.toHaveBeenCalled();

    const selectedRepository = new InMemorySessionRepository();
    const selectedStarted = await startSessionUseCase(
      selectedRepository,
      new FakeClock(1_000),
      'skip-selected-use-case',
      restartBonusWorkflow(),
    );
    const selectedClock = new FakeClock(3_000);
    const rewardPaused = await advanceSessionUseCase(
      selectedRepository,
      selectedClock,
      selectedStarted.id,
    );
    if (rewardPaused.rewardRitual === undefined)
      throw new Error('Expected Reward pause.');
    await rollSessionRewardUseCase(
      selectedRepository,
      selectedStarted.id,
      () => 0,
      false,
      'roll-before-skip',
      rewardPaused.rewardRitual.id,
    );
    const before = await selectedRepository.get(selectedStarted.id);
    const selectedSave = vi.spyOn(selectedRepository, 'save');
    await expect(
      skipSessionRewardUseCase(
        selectedRepository,
        selectedClock,
        selectedStarted.id,
        'skip-selected-command',
        rewardPaused.rewardRitual.id,
      ),
    ).rejects.toThrow();
    expect(selectedSave).not.toHaveBeenCalled();
    await expect(selectedRepository.get(selectedStarted.id)).resolves.toEqual(
      before,
    );
  });

  test('completes a final skipped Reward and leaves its stored pause intact when saving fails', async () => {
    const repository = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const started = await startSessionUseCase(
      repository,
      clock,
      'skip-final-reward-use-case',
      restartBonusWorkflow(true),
    );
    clock.set(3_000);
    const paused = await advanceSessionUseCase(repository, clock, started.id);
    if (paused.rewardRitual === undefined)
      throw new Error('Expected final Reward pause.');
    const save = vi
      .spyOn(repository, 'save')
      .mockRejectedValueOnce(new Error('save failed'));

    await expect(
      skipSessionRewardUseCase(
        repository,
        clock,
        started.id,
        'skip-final-reward',
        paused.rewardRitual.id,
      ),
    ).rejects.toThrow('save failed');
    expect(save).toHaveBeenCalledTimes(1);
    await expect(repository.get(started.id)).resolves.toEqual(paused);

    save.mockRestore();
    await expect(
      skipSessionRewardUseCase(
        repository,
        clock,
        started.id,
        'skip-final-reward-retry',
        paused.rewardRitual.id,
      ),
    ).resolves.toMatchObject({ status: 'completed', completedAt: 3_000 });
  });
});
