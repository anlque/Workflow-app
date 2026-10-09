import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  createSession,
  continueRewardSession,
  getRemainingSeconds,
  pauseSession,
  rerollSessionReward,
  restartSessionPhase,
  restartSessionWorkflow,
  restoreSession,
  resumeSession,
  rollSessionReward,
  stopSession,
} from './Session';
import { deriveSessionState } from './deriveSessionState';

function workflow() {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'break', durationSeconds: 5, environment: {} },
      { type: 'focus', durationSeconds: 20, environment: {} },
    ],
  });
}

function bonusWorkflow(final = false) {
  return createWorkflow({
    id: final ? 'bonus-final' : 'bonus-non-final',
    name: 'Bonus work',
    phases: final
      ? [{ type: 'focus', durationSeconds: 10, environment: {} }]
      : [
          { type: 'focus', durationSeconds: 10, environment: {} },
          { type: 'break', durationSeconds: 5, environment: {} },
        ],
    rewardDice: {
      frequency: 1,
      sides: [
        {
          icon: 'tea',
          title: 'Tea',
          bonusPhase: {
            name: 'Tea break',
            durationSeconds: 30,
            environment: { backgroundColor: '#123456' },
          },
        },
        { icon: 'walk', title: 'Walk' },
      ],
    },
  });
}

function runningBonus(final = false) {
  const paused = deriveSessionState(
    createSession(
      final ? 'bonus-final-session' : 'bonus-session',
      bonusWorkflow(final),
      1_000,
    ),
    12_000,
  );
  const continued = continueRewardSession(
    rollSessionReward(paused, () => 0, 'roll-bonus'),
    20_000,
    'continue-bonus',
  );
  if (continued.status !== 'running') {
    throw new Error('Expected running Bonus.');
  }
  return continued;
}

function acceptedNormalPhase(withBonus: boolean) {
  const rewardPaused = deriveSessionState(
    createSession('accepted-reward-session', bonusWorkflow(), 1_000),
    12_000,
  );
  const rolled = rollSessionReward(
    rewardPaused,
    () => (withBonus ? 0 : 0.99),
    'roll-accepted',
  );
  const continued = continueRewardSession(rolled, 20_000, 'continue-accepted');

  return withBonus ? deriveSessionState(continued, 50_000) : continued;
}

describe('Session', () => {
  test('restarts a normal Phase and the complete Workflow authoritatively', () => {
    const phaseOne = deriveSessionState(
      createSession('restart-session', workflow(), 1_000),
      13_000,
    );
    const restartedPhase = restartSessionPhase(
      phaseOne,
      14_000,
      'restart-phase-1',
      { type: 'phase', phaseIndex: 1 },
    );

    expect(restartedPhase).toMatchObject({
      id: 'restart-session',
      currentPhaseIndex: 1,
      status: 'running',
      phaseStartedAt: 14_000,
      phaseEndsAt: 19_000,
      restartCommandReceipts: [
        {
          commandId: 'restart-phase-1',
          type: 'restart-phase',
          target: { type: 'phase', phaseIndex: 1 },
        },
      ],
    });

    const restartedWorkflow = restartSessionWorkflow(
      restartedPhase,
      15_000,
      'restart-workflow-1',
    );
    expect(restartedWorkflow).toMatchObject({
      id: 'restart-session',
      currentPhaseIndex: 0,
      status: 'running',
      phaseStartedAt: 15_000,
      phaseEndsAt: 25_000,
      rewardCommandReceipts: [],
      restartCommandReceipts: [
        { commandId: 'restart-phase-1' },
        { commandId: 'restart-workflow-1', type: 'restart-workflow' },
      ],
    });
  });

  test('restarts a user-paused normal Phase, rejects stale targets and keeps bounded immutable receipts', () => {
    const paused = pauseSession(
      createSession('restart-paused', workflow(), 1_000),
      2_000,
    );
    expect(() =>
      restartSessionPhase(paused, 3_000, 'stale', {
        type: 'phase',
        phaseIndex: 1,
      }),
    ).toThrow();

    let restarted = restartSessionPhase(paused, 3_000, 'restart-0', {
      type: 'phase',
      phaseIndex: 0,
    });
    expect(restarted).toMatchObject({
      status: 'running',
      phaseStartedAt: 3_000,
      phaseEndsAt: 13_000,
    });
    const pausedAfterRestart = pauseSession(restarted, 4_000);
    expect(
      restartSessionPhase(pausedAfterRestart, 5_000, 'restart-0', {
        type: 'phase',
        phaseIndex: 0,
      }),
    ).toBe(pausedAfterRestart);
    for (let index = 1; index <= 16; index += 1) {
      restarted = restartSessionPhase(
        restarted,
        3_000 + index,
        `restart-${String(index)}`,
        { type: 'phase', phaseIndex: 0 },
      );
    }
    expect(restarted.restartCommandReceipts).toHaveLength(16);
    expect(restarted.restartCommandReceipts[0]?.commandId).toBe('restart-1');
    expect(Object.isFrozen(restarted.restartCommandReceipts)).toBe(true);
    expect(Object.isFrozen(restarted.restartCommandReceipts[0])).toBe(true);
    const target = restarted.restartCommandReceipts[0];
    if (target?.type !== 'restart-phase') throw new Error('Expected receipt.');
    expect(Object.isFrozen(target.target)).toBe(true);
    expect(
      restartSessionPhase(restarted, 30_000, 'restart-16', {
        type: 'phase',
        phaseIndex: 0,
      }),
    ).toBe(restarted);
    expect(() =>
      restartSessionWorkflow(restarted, 30_000, 'restart-16'),
    ).toThrow();
  });

  test('rejects restart commands outside Running and user-paused states', () => {
    const initial = createSession('restart-rejected', workflow(), 1_000);
    const transitioning = deriveSessionState(initial, 11_000);
    const rewardPaused = deriveSessionState(
      createSession('restart-reward', bonusWorkflow(), 1_000),
      12_000,
    );
    const stopped = stopSession(initial, 2_000);
    const completed = deriveSessionState(
      createSession(
        'restart-complete',
        createWorkflow({
          id: 'complete-workflow',
          name: 'Complete',
          phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
        }),
        1_000,
      ),
      3_000,
    );

    for (const session of [transitioning, rewardPaused, stopped, completed]) {
      expect(() =>
        restartSessionPhase(session, 4_000, 'phase-rejected', {
          type: 'phase',
          phaseIndex: session.currentPhaseIndex,
        }),
      ).toThrow();
      expect(() =>
        restartSessionWorkflow(session, 4_000, 'workflow-rejected'),
      ).toThrow();
    }
  });

  test('restarts a paused Bonus Workflow at Phase 0 and clears all Reward progress', () => {
    const bonus = runningBonus();
    const paused = pauseSession(bonus, 25_000);
    const restarted = restartSessionWorkflow(
      paused,
      30_000,
      'restart-bonus-workflow',
    );

    expect(restarted).toMatchObject({
      id: paused.id,
      sourceWorkflowId: paused.sourceWorkflowId,
      currentPhaseIndex: 0,
      status: 'running',
      phaseStartedAt: 30_000,
      phaseEndsAt: 40_000,
      rewardCommandReceipts: [],
      restartCommandReceipts: [
        {
          commandId: 'restart-bonus-workflow',
          type: 'restart-workflow',
        },
      ],
    });
    expect(restarted.snapshot).toBe(paused.snapshot);
    expect(restarted).not.toHaveProperty('rewardRitual');
    expect(restarted).not.toHaveProperty('activeBonusPhase');
  });

  test('starts a non-final Bonus without changing Workflow phase identity', () => {
    const bonus = runningBonus();

    expect(bonus).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 20_000,
      phaseEndsAt: 50_000,
      activeBonusPhase: {
        rewardRitualId: 'bonus-session:0',
        selectedSideIndex: 0,
      },
      rewardRitual: { acknowledged: true },
    });
    expect(bonus.snapshot.workflow.phases).toHaveLength(2);
    expect(Object.isFrozen(bonus.activeBonusPhase)).toBe(true);
  });

  test('starts a final Bonus instead of completing immediately', () => {
    expect(runningBonus(true)).toMatchObject({
      status: 'running',
      currentPhaseIndex: 0,
      phaseEndsAt: 50_000,
      activeBonusPhase: {
        rewardRitualId: 'bonus-final-session:0',
        selectedSideIndex: 0,
      },
      rewardRitual: { continuation: { type: 'complete' } },
    });
  });

  test('pauses, resumes and restarts the active Bonus with authoritative time', () => {
    const running = runningBonus();
    const paused = pauseSession(running, 25_500);
    if (
      paused.rewardRitual === undefined ||
      paused.activeBonusPhase === undefined
    ) {
      throw new Error('Expected paused Bonus state.');
    }
    const { rewardRitual, activeBonusPhase } = paused;
    expect(paused).toMatchObject({
      status: 'paused',
      pauseReason: 'user',
      remainingMilliseconds: 24_500,
      activeBonusPhase: { rewardRitualId: 'bonus-session:0' },
    });
    expect(resumeSession(paused, 30_000)).toMatchObject({
      status: 'running',
      phaseEndsAt: 54_500,
      activeBonusPhase: { rewardRitualId: 'bonus-session:0' },
    });
    expect(() =>
      restoreSession({
        id: paused.id,
        workflow: paused.snapshot.workflow,
        currentPhaseIndex: paused.currentPhaseIndex,
        rewardCommandReceipts: paused.rewardCommandReceipts,
        restartCommandReceipts: paused.restartCommandReceipts,
        rewardRitual,
        activeBonusPhase,
        status: 'paused',
        pauseReason: 'user',
        pausedAt: paused.pausedAt,
        remainingMilliseconds: paused.remainingMilliseconds,
      }),
    ).not.toThrow();
    const restarted = restartSessionPhase(paused, 40_000, 'restart-1', {
      type: 'bonus',
      rewardRitualId: activeBonusPhase.rewardRitualId,
    });
    expect(restarted).toMatchObject({
      status: 'running',
      phaseStartedAt: 40_000,
      phaseEndsAt: 70_000,
    });
    expect(restarted.restartCommandReceipts.at(-1)).toEqual({
      commandId: 'restart-1',
      type: 'restart-phase',
      target: { type: 'bonus', rewardRitualId: 'bonus-session:0' },
    });
  });

  test.each([
    ['after a non-final Bonus expires', true, 50_000, 51_000],
    ['after an accepted Reward without Bonus', false, 20_000, 21_000],
  ] as const)(
    'pauses, restores and resumes the normal Phase %s',
    (_scenario, withBonus, phaseStartedAt, pausedAt) => {
      const running = acceptedNormalPhase(withBonus);
      expect(running).toMatchObject({
        status: 'running',
        currentPhaseIndex: 1,
        phaseStartedAt,
        rewardRitual: {
          acknowledged: true,
          continuation: { type: 'phase', phaseIndex: 1 },
        },
      });
      expect(running).not.toHaveProperty('activeBonusPhase');

      const paused = pauseSession(running, pausedAt);
      if (paused.rewardRitual === undefined) {
        throw new Error('Expected acknowledged Reward history.');
      }
      const restored = restoreSession({
        id: paused.id,
        workflow: paused.snapshot.workflow,
        currentPhaseIndex: paused.currentPhaseIndex,
        rewardCommandReceipts: paused.rewardCommandReceipts,
        restartCommandReceipts: paused.restartCommandReceipts,
        rewardRitual: paused.rewardRitual,
        status: 'paused',
        pauseReason: 'user',
        pausedAt: paused.pausedAt,
        remainingMilliseconds: paused.remainingMilliseconds,
      });

      expect(restored).toEqual(paused);
      expect(resumeSession(restored, pausedAt + 1_000)).toMatchObject({
        status: 'running',
        currentPhaseIndex: 1,
        rewardRitual: { acknowledged: true },
      });
    },
  );

  test('rejects an active Bonus marker outside its linked timed state', () => {
    const running = runningBonus();
    if (
      running.rewardRitual === undefined ||
      running.activeBonusPhase === undefined
    ) {
      throw new Error('Expected running Bonus.');
    }
    const common = {
      id: running.id,
      workflow: running.snapshot.workflow,
      currentPhaseIndex: running.currentPhaseIndex,
      rewardCommandReceipts: running.rewardCommandReceipts,
      restartCommandReceipts: running.restartCommandReceipts,
      rewardRitual: running.rewardRitual,
      activeBonusPhase: running.activeBonusPhase,
    };

    expect(() =>
      restoreSession({
        ...common,
        activeBonusPhase: {
          rewardRitualId: 'wrong:0',
          selectedSideIndex: 0,
        },
        status: 'running',
        phaseStartedAt: 20_000,
        phaseEndsAt: 50_000,
      }),
    ).toThrow('Session Bonus Reward Phase is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'completed',
        completedAt: 50_000,
      }),
    ).toThrow('Session Bonus Reward Phase is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'transitioning',
        transitionEndsAt: 50_000,
      }),
    ).toThrow('Session Bonus Reward Phase is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'paused',
        pauseReason: 'reward',
        pausedAt: 20_000,
        remainingMilliseconds: 5_000,
      }),
    ).toThrow('Session Bonus Reward Phase is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'stopped',
        stoppedAt: 20_000,
      }),
    ).toThrow('Session Bonus Reward Phase is invalid.');

    const finalBonus = runningBonus(true);
    if (finalBonus.rewardRitual === undefined) {
      throw new Error('Expected final Bonus ritual.');
    }
    const finalRitual = finalBonus.rewardRitual;
    expect(() =>
      restoreSession({
        id: finalBonus.id,
        workflow: finalBonus.snapshot.workflow,
        currentPhaseIndex: finalBonus.currentPhaseIndex,
        rewardCommandReceipts: finalBonus.rewardCommandReceipts,
        restartCommandReceipts: finalBonus.restartCommandReceipts,
        rewardRitual: finalRitual,
        status: 'running',
        phaseStartedAt: finalBonus.phaseStartedAt,
        phaseEndsAt: finalBonus.phaseEndsAt,
      }),
    ).toThrow('Session Reward ritual is invalid.');
  });

  test('reconciles non-final and final Bonus completion without another Reward', () => {
    expect(deriveSessionState(runningBonus(), 50_000)).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 50_000,
      phaseEndsAt: 55_000,
    });
    const late = deriveSessionState(runningBonus(), 60_000);
    expect(late.status).toBe('completed');
    expect(late).not.toHaveProperty('activeBonusPhase');

    expect(deriveSessionState(runningBonus(true), 60_000)).toMatchObject({
      status: 'completed',
      completedAt: 50_000,
      currentPhaseIndex: 0,
    });
  });

  test('owns Reward selection, rerolls and continuation in the Session aggregate', () => {
    const rewarded = createWorkflow({
      id: 'workflow-authoritative-reward',
      name: 'Rewarded work',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        rerolls: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'direct', assetId: 'image-1' },
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('session-1', rewarded, 1_000),
      12_000,
    );

    const rolled = rollSessionReward(paused, () => 0);
    const rerolled = rerollSessionReward(rolled, () => 0.99);

    expect(rolled).toMatchObject({
      rewardRitual: {
        id: 'session-1:0',
        completedPhaseIndex: 0,
        selectedSideIndex: 0,
        rerollsUsed: 0,
        acknowledged: false,
        continuation: { type: 'phase', phaseIndex: 1 },
      },
    });
    expect(rerolled).toMatchObject({
      rewardRitual: { selectedSideIndex: 1, rerollsUsed: 1 },
    });
    expect(() => rerollSessionReward(rerolled, () => 0)).toThrow();
    expect(continueRewardSession(rerolled, 20_000, 'continue-1')).toMatchObject(
      {
        status: 'running',
        currentPhaseIndex: 1,
        phaseEndsAt: 25_000,
        rewardRitual: { acknowledged: true, selectedSideIndex: 1 },
      },
    );
  });

  test('keeps a final Reward actionable until it is rolled and acknowledged', () => {
    const rewarded = createWorkflow({
      id: 'workflow-final-reward',
      name: 'Final reward',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('session-final', rewarded, 1_000),
      12_000,
    );

    expect(paused).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      rewardRitual: { continuation: { type: 'complete' } },
    });
    expect(() => continueRewardSession(paused, 20_000, 'continue-1')).toThrow();
    expect(
      continueRewardSession(
        rollSessionReward(paused, () => 0),
        20_000,
        'continue-2',
      ),
    ).toMatchObject({
      status: 'completed',
      completedAt: 20_000,
      rewardRitual: { acknowledged: true, continuation: { type: 'complete' } },
    });
  });
  test('starts from a deeply immutable independent Workflow snapshot', () => {
    const source = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        rerolls: 3,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 300,
              environment: {
                backgroundAsset: { type: 'direct', assetId: 'image-1' },
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    const session = createSession('session-1', source, 1_000);

    expect(session.status).toBe('running');
    expect(session.currentPhaseIndex).toBe(0);
    expect(session.phaseStartedAt).toBe(1_000);
    expect(session.phaseEndsAt).toBe(11_000);
    expect(session.snapshot.workflow).toEqual(source);
    expect(session.snapshot.workflow).not.toBe(source);
    expect(session.snapshot.workflow.phases).not.toBe(source.phases);
    expect(session.snapshot.workflow.rewardDice?.rerolls).toBe(3);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.snapshot)).toBe(true);
    expect(Object.isFrozen(session.snapshot.workflow)).toBe(true);
    expect(Object.isFrozen(session.snapshot.workflow.phases)).toBe(true);
    const bonus = session.snapshot.workflow.rewardDice?.sides[0]?.bonusPhase;
    expect(Object.isFrozen(bonus)).toBe(true);
    expect(Object.isFrozen(bonus?.environment)).toBe(true);
    expect(Object.isFrozen(bonus?.environment.backgroundAsset)).toBe(true);
  });

  test('rejects an unresolved Role before creating a Session snapshot', () => {
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

    expect(() => createSession('session-1', source, 1_000)).toThrow(
      'Session snapshot requires direct Asset references.',
    );
  });

  test('rejects an unresolved Role in a Bonus Reward Phase before snapshot creation', () => {
    const source = createWorkflow({
      id: 'workflow-bonus-role',
      name: 'Bonus Role workflow',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 300,
              environment: {
                audioAsset: { type: 'role', role: 'Ambient' },
              },
            },
          },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    expect(() => createSession('session-1', source, 1_000)).toThrow(
      'Session snapshot requires direct Asset references.',
    );
  });

  test('pauses with exact remaining milliseconds after reconciling elapsed time', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const paused = pauseSession(running, 4_250);

    expect(paused.status).toBe('paused');
    expect(paused.pauseReason).toBe('user');
    expect(paused.currentPhaseIndex).toBe(0);
    expect(paused.remainingMilliseconds).toBe(6_750);
    expect(paused.pausedAt).toBe(4_250);
    expect(getRemainingSeconds(paused, 99_000)).toBe(7);
  });

  test('resumes from the exact paused duration using a new timing anchor', () => {
    const paused = pauseSession(
      createSession('session-1', workflow(), 1_000),
      4_250,
    );

    const resumed = resumeSession(paused, 20_000);

    expect(resumed.status).toBe('running');
    expect(resumed.phaseStartedAt).toBe(20_000);
    expect(resumed.phaseEndsAt).toBe(26_750);
  });

  test('stops an active Session', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const stopped = stopSession(running, 2_000);

    expect(stopped.status).toBe('stopped');
    expect(stopped.stoppedAt).toBe(2_000);
  });

  test('enters a one-second transition at the exact Phase boundary', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const advanced = deriveSessionState(running, 11_000);

    expect(advanced.status).toBe('transitioning');
    if (advanced.status !== 'transitioning') {
      throw new Error('Expected Session to be transitioning.');
    }
    expect(advanced.currentPhaseIndex).toBe(0);
    expect(advanced.transitionEndsAt).toBe(12_000);
  });

  test('starts the next Phase at full duration after the transition', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const advanced = deriveSessionState(running, 12_000);

    expect(advanced.status).toBe('running');
    if (advanced.status !== 'running') {
      throw new Error('Expected Session to remain running.');
    }
    expect(advanced.currentPhaseIndex).toBe(1);
    expect(advanced.phaseStartedAt).toBe(12_000);
    expect(advanced.phaseEndsAt).toBe(17_000);
  });

  test('advances across multiple elapsed Phases after a late wake-up', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const advanced = deriveSessionState(running, 20_000);

    expect(advanced.status).toBe('running');
    if (advanced.status !== 'running') {
      throw new Error('Expected Session to remain running.');
    }
    expect(advanced.currentPhaseIndex).toBe(2);
    expect(advanced.phaseStartedAt).toBe(18_000);
    expect(advanced.phaseEndsAt).toBe(38_000);
    expect(getRemainingSeconds(advanced, 20_000)).toBe(18);
  });

  test('completes at the scheduled final boundary after a late wake-up', () => {
    const running = createSession('session-1', workflow(), 1_000);

    const completed = deriveSessionState(running, 50_000);

    expect(completed.status).toBe('completed');
    if (completed.status !== 'completed') {
      throw new Error('Expected Session to be completed.');
    }
    expect(completed.completedAt).toBe(39_000);
    expect(completed.currentPhaseIndex).toBe(2);
    expect(getRemainingSeconds(completed, 50_000)).toBe(0);
  });

  test('pauses the full next Phase when a Reward is due', () => {
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

    const paused = deriveSessionState(
      createSession('session-1', rewarded, 1_000),
      12_000,
    );

    expect(paused).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      currentPhaseIndex: 1,
      pausedAt: 12_000,
      remainingMilliseconds: 5_000,
    });
  });

  test('pauses only after a qualifying break when Reward Dice targets breaks', () => {
    const rewarded = createWorkflow({
      id: 'workflow-break-rewarded',
      name: 'Rewarded recovery',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
        { type: 'focus', durationSeconds: 20, environment: {} },
      ],
      rewardDice: {
        triggerPhaseType: 'break',
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const initial = createSession('session-1', rewarded, 1_000);

    expect(deriveSessionState(initial, 12_000)).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseEndsAt: 17_000,
    });
    expect(deriveSessionState(initial, 18_000)).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      currentPhaseIndex: 2,
      remainingMilliseconds: 20_000,
    });
  });

  test('stops late derivation at the first Reward pause', () => {
    const rewarded = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Rewarded work',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
        { type: 'focus', durationSeconds: 20, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });

    const paused = deriveSessionState(
      createSession('session-1', rewarded, 1_000),
      99_000,
    );

    expect(paused).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      currentPhaseIndex: 1,
      remainingMilliseconds: 5_000,
    });
  });

  test('offers a final eligible Reward only after its transition', () => {
    const rewarded = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Rewarded work',
      phases: [{ type: 'focus', durationSeconds: 10, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const running = createSession('session-1', rewarded, 1_000);

    expect(deriveSessionState(running, 11_999).status).toBe('transitioning');
    expect(deriveSessionState(running, 12_000)).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      currentPhaseIndex: 0,
      rewardRitual: { continuation: { type: 'complete' } },
    });
  });

  test('continues only a Reward pause with a fresh full-duration anchor', () => {
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
    const paused = deriveSessionState(
      createSession('session-1', rewarded, 1_000),
      12_000,
    );

    const continued = continueRewardSession(
      rollSessionReward(paused, () => 0, 'roll-1'),
      20_000,
      'continue-1',
    );

    expect(continued).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 20_000,
      phaseEndsAt: 25_000,
    });
    expect(Object.isFrozen(continued.rewardRitual)).toBe(true);
    expect(Object.isFrozen(continued.rewardRitual?.continuation)).toBe(true);
    expect(Object.isFrozen(continued.rewardCommandReceipts)).toBe(true);
    expect(Object.isFrozen(continued.rewardCommandReceipts[0])).toBe(true);
    expect(() =>
      continueRewardSession(
        pauseSession(createSession('session-2', workflow(), 1_000), 2_000),
        3_000,
        'continue-2',
      ),
    ).toThrow('Session transition is not valid for its current state.');
  });

  test('rejects rituals that contradict canonical v5 Session state', () => {
    const rewarded = createWorkflow({
      id: 'strict-ritual',
      name: 'Strict ritual',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'a', title: 'A' },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('strict-session', rewarded, 1_000),
      3_000,
    );
    if (paused.status !== 'paused' || paused.rewardRitual === undefined) {
      throw new Error('Expected Reward pause.');
    }
    const rewardRitual = paused.rewardRitual;
    const common = {
      id: paused.id,
      workflow: paused.snapshot.workflow,
      currentPhaseIndex: paused.currentPhaseIndex,
      rewardCommandReceipts: paused.rewardCommandReceipts,
      restartCommandReceipts: paused.restartCommandReceipts,
      rewardRitual,
    };

    expect(() =>
      restoreSession({
        ...common,
        status: 'paused',
        pauseReason: 'user',
        pausedAt: 3_000,
        remainingMilliseconds: 1_000,
      }),
    ).toThrow('Session Reward ritual is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'transitioning',
        transitionEndsAt: 4_000,
      }),
    ).toThrow('Session Reward ritual is invalid.');
    expect(() =>
      restoreSession({ ...common, status: 'stopped', stoppedAt: 4_000 }),
    ).toThrow('Session Reward ritual is invalid.');
    expect(() =>
      restoreSession({
        ...common,
        status: 'running',
        phaseStartedAt: 4_000,
        phaseEndsAt: 5_000,
      }),
    ).toThrow('Session Reward ritual is invalid.');
  });

  test('rejects a restored Side that is ineligible for its Reward opportunity', () => {
    const rewarded = createWorkflow({
      id: 'eligible-ritual',
      name: 'Eligible ritual',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
        { type: 'focus', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        schedule: { type: 'custom', phaseIndexes: [0, 2] },
        sides: [
          { icon: 'a', title: 'Early', availability: 'early' },
          { icon: 'b', title: 'Late', availability: 'late' },
        ],
      },
    });
    const paused = deriveSessionState(
      createSession('eligible-session', rewarded, 1_000),
      3_000,
    );
    if (paused.status !== 'paused' || paused.rewardRitual === undefined) {
      throw new Error('Expected Reward pause.');
    }
    const rewardRitual = paused.rewardRitual;

    expect(() =>
      restoreSession({
        id: paused.id,
        workflow: paused.snapshot.workflow,
        currentPhaseIndex: paused.currentPhaseIndex,
        rewardCommandReceipts: paused.rewardCommandReceipts,
        restartCommandReceipts: paused.restartCommandReceipts,
        status: 'paused',
        pauseReason: 'reward',
        pausedAt: paused.pausedAt,
        remainingMilliseconds: paused.remainingMilliseconds,
        rewardRitual: {
          ...rewardRitual,
          selectedSideIndex: 1,
        },
      }),
    ).toThrow('Session Reward ritual is invalid.');
  });

  test('rejects ordinary commands while transitioning and Resume for a Reward pause', () => {
    const transitioning = deriveSessionState(
      createSession('session-1', workflow(), 1_000),
      11_000,
    );

    expect(() => pauseSession(transitioning, 11_500)).toThrow();
    expect(() => resumeSession(transitioning, 11_500)).toThrow();
    expect(() => stopSession(transitioning, 11_500)).toThrow();

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
    const rewardPaused = deriveSessionState(
      createSession('session-2', rewarded, 1_000),
      12_000,
    );
    expect(() => resumeSession(rewardPaused, 20_000)).toThrow();
  });

  test.each([
    [
      'pause',
      () =>
        pauseSession(
          pauseSession(createSession('session-1', workflow(), 1_000), 2_000),
          3_000,
        ),
    ],
    [
      'resume',
      () => resumeSession(createSession('session-1', workflow(), 1_000), 2_000),
    ],
    [
      'stop completed',
      () =>
        stopSession(
          deriveSessionState(
            createSession('session-1', workflow(), 1_000),
            50_000,
          ),
          51_000,
        ),
    ],
  ])('rejects invalid %s transition', (_name, transition) => {
    expect(transition).toThrow(
      'Session transition is not valid for its current state.',
    );
  });

  test('rejects an invalid clock value', () => {
    expect(() => createSession('session-1', workflow(), Number.NaN)).toThrow(
      'Clock must return a finite non-negative epoch millisecond value.',
    );
  });
});
