import { describe, expect, test } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  createSession,
  continueRewardSession,
  getRemainingSeconds,
  pauseSession,
  resumeSession,
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

describe('Session', () => {
  test('starts from a deeply immutable independent Workflow snapshot', () => {
    const source = workflow();

    const session = createSession('session-1', source, 1_000);

    expect(session.status).toBe('running');
    expect(session.currentPhaseIndex).toBe(0);
    expect(session.phaseStartedAt).toBe(1_000);
    expect(session.phaseEndsAt).toBe(11_000);
    expect(session.snapshot.workflow).toEqual(source);
    expect(session.snapshot.workflow).not.toBe(source);
    expect(session.snapshot.workflow.phases).not.toBe(source.phases);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.snapshot)).toBe(true);
    expect(Object.isFrozen(session.snapshot.workflow)).toBe(true);
    expect(Object.isFrozen(session.snapshot.workflow.phases)).toBe(true);
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

  test('completes a final eligible Phase only after its transition', () => {
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
      status: 'completed',
      currentPhaseIndex: 0,
      completedAt: 12_000,
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

    const continued = continueRewardSession(paused, 20_000);

    expect(continued).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseStartedAt: 20_000,
      phaseEndsAt: 25_000,
    });
    expect(() =>
      continueRewardSession(
        pauseSession(createSession('session-2', workflow(), 1_000), 2_000),
        3_000,
      ),
    ).toThrow('Session transition is not valid for its current state.');
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
