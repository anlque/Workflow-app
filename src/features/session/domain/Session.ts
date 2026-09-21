import {
  rollReward,
  type Workflow,
  type WorkflowId,
} from '@/features/workflow';

import {
  SessionTransitionError,
  SessionValidationError,
} from './SessionErrors';
import { createSessionSnapshot, type SessionSnapshot } from './SessionSnapshot';
import { deriveSessionState } from './deriveSessionState';
import { validateEpochMilliseconds } from './validateEpochMilliseconds';

declare const sessionIdBrand: unique symbol;

export type SessionId = string & { readonly [sessionIdBrand]: 'SessionId' };

type SessionBase = Readonly<{
  id: SessionId;
  sourceWorkflowId: WorkflowId;
  snapshot: SessionSnapshot;
  currentPhaseIndex: number;
  rewardRitual?: RewardRitual;
}>;

export type RewardContinuationTarget =
  | Readonly<{ type: 'phase'; phaseIndex: number }>
  | Readonly<{ type: 'complete' }>;

export type RewardRitual = Readonly<{
  id: string;
  completedPhaseIndex: number;
  selectedSideIndex?: number;
  rerollsUsed: number;
  acknowledged: boolean;
  lastCommandId?: string;
  continuation: RewardContinuationTarget;
}>;

export type RunningSession = SessionBase &
  Readonly<{
    status: 'running';
    phaseStartedAt: number;
    phaseEndsAt: number;
  }>;

export type TransitioningSession = SessionBase &
  Readonly<{
    status: 'transitioning';
    transitionEndsAt: number;
  }>;

export type PausedSession = SessionBase &
  Readonly<{
    status: 'paused';
    pauseReason: 'user' | 'reward';
    pausedAt: number;
    remainingMilliseconds: number;
  }>;

export type CompletedSession = SessionBase &
  Readonly<{
    status: 'completed';
    completedAt: number;
  }>;

export type StoppedSession = SessionBase &
  Readonly<{
    status: 'stopped';
    stoppedAt: number;
  }>;

export type Session =
  | RunningSession
  | TransitioningSession
  | PausedSession
  | CompletedSession
  | StoppedSession;

export type RestoreSessionInput =
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardRitual?: RewardRitual;
      status: 'running';
      phaseStartedAt: number;
      phaseEndsAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardRitual?: RewardRitual;
      status: 'transitioning';
      transitionEndsAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardRitual?: RewardRitual;
      status: 'paused';
      pauseReason?: 'user' | 'reward';
      pausedAt: number;
      remainingMilliseconds: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardRitual?: RewardRitual;
      status: 'completed';
      completedAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardRitual?: RewardRitual;
      status: 'stopped';
      stoppedAt: number;
    }>;

export function createSessionId(value: string): SessionId {
  if (value.trim().length === 0) {
    throw new SessionValidationError('Session identifier must not be empty.');
  }

  return value as SessionId;
}

export function createSession(
  id: string,
  workflow: Workflow,
  now: number,
): RunningSession {
  validateEpochMilliseconds(now);
  const snapshot = createSessionSnapshot(workflow);
  const firstPhase = snapshot.workflow.phases[0];

  return Object.freeze({
    id: createSessionId(id),
    sourceWorkflowId: workflow.id,
    snapshot,
    currentPhaseIndex: 0,
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + firstPhase.durationSeconds * 1_000,
  });
}

export function restoreSession(input: RestoreSessionInput): Session {
  if (
    !Number.isInteger(input.currentPhaseIndex) ||
    input.currentPhaseIndex < 0 ||
    input.currentPhaseIndex >= input.workflow.phases.length
  ) {
    throw new SessionValidationError('Session current Phase index is invalid.');
  }

  const base = {
    id: createSessionId(input.id),
    sourceWorkflowId: input.workflow.id,
    snapshot: createSessionSnapshot(input.workflow),
    currentPhaseIndex: input.currentPhaseIndex,
    ...(input.rewardRitual === undefined
      ? {}
      : { rewardRitual: Object.freeze(input.rewardRitual) }),
  };
  if (input.status !== 'paused' && input.rewardRitual !== undefined) {
    validateRewardRitual(input, input.rewardRitual);
  }

  if (input.status === 'running') {
    validateEpochMilliseconds(input.phaseStartedAt);
    validateEpochMilliseconds(input.phaseEndsAt);
    if (input.phaseEndsAt <= input.phaseStartedAt) {
      throw new SessionValidationError(
        'Running Session timing anchors are invalid.',
      );
    }
    return Object.freeze({
      ...base,
      status: input.status,
      phaseStartedAt: input.phaseStartedAt,
      phaseEndsAt: input.phaseEndsAt,
    });
  }
  if (input.status === 'paused') {
    validateEpochMilliseconds(input.pausedAt);
    if (
      !Number.isFinite(input.remainingMilliseconds) ||
      input.remainingMilliseconds < 0 ||
      (input.remainingMilliseconds === 0 && input.pauseReason !== 'reward')
    ) {
      throw new SessionValidationError(
        'Paused Session remaining time is invalid.',
      );
    }
    const rewardRitual =
      input.pauseReason === 'reward'
        ? (input.rewardRitual ?? {
            id: `${input.id}:${String(Math.max(0, input.currentPhaseIndex - 1))}`,
            completedPhaseIndex: Math.max(0, input.currentPhaseIndex - 1),
            rerollsUsed: 0,
            acknowledged: false,
            continuation: {
              type: 'phase' as const,
              phaseIndex: input.currentPhaseIndex,
            },
          })
        : undefined;
    if (input.rewardRitual !== undefined) {
      validateRewardRitual(input, input.rewardRitual);
    }
    return Object.freeze({
      ...base,
      status: input.status,
      pauseReason: input.pauseReason ?? 'user',
      pausedAt: input.pausedAt,
      remainingMilliseconds: input.remainingMilliseconds,
      ...(rewardRitual === undefined
        ? {}
        : { rewardRitual: Object.freeze(rewardRitual) }),
    });
  }
  if (input.status === 'transitioning') {
    validateEpochMilliseconds(input.transitionEndsAt);
    return Object.freeze({
      ...base,
      status: input.status,
      transitionEndsAt: input.transitionEndsAt,
    });
  }
  if (input.status === 'completed') {
    validateEpochMilliseconds(input.completedAt);
    return Object.freeze({
      ...base,
      status: input.status,
      completedAt: input.completedAt,
    });
  }
  validateEpochMilliseconds(input.stoppedAt);
  return Object.freeze({
    ...base,
    status: input.status,
    stoppedAt: input.stoppedAt,
  });
}

export function pauseSession(session: Session, now: number): PausedSession {
  const reconciled = deriveSessionState(session, now);
  if (reconciled.status !== 'running') {
    throw new SessionTransitionError();
  }

  return Object.freeze({
    id: reconciled.id,
    sourceWorkflowId: reconciled.sourceWorkflowId,
    snapshot: reconciled.snapshot,
    currentPhaseIndex: reconciled.currentPhaseIndex,
    status: 'paused',
    pauseReason: 'user',
    pausedAt: now,
    remainingMilliseconds: reconciled.phaseEndsAt - now,
  });
}

export function resumeSession(session: Session, now: number): RunningSession {
  validateEpochMilliseconds(now);
  if (session.status !== 'paused' || session.pauseReason !== 'user') {
    throw new SessionTransitionError();
  }

  return Object.freeze({
    id: session.id,
    sourceWorkflowId: session.sourceWorkflowId,
    snapshot: session.snapshot,
    currentPhaseIndex: session.currentPhaseIndex,
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + session.remainingMilliseconds,
  });
}

export function continueRewardSession(
  session: Session,
  now: number,
): RunningSession | CompletedSession {
  validateEpochMilliseconds(now);
  if (
    session.status !== 'paused' ||
    session.pauseReason !== 'reward' ||
    session.rewardRitual?.selectedSideIndex === undefined
  ) {
    throw new SessionTransitionError();
  }
  if (session.rewardRitual.continuation.type === 'complete') {
    return Object.freeze({
      id: session.id,
      sourceWorkflowId: session.sourceWorkflowId,
      snapshot: session.snapshot,
      currentPhaseIndex: session.currentPhaseIndex,
      status: 'completed',
      completedAt: now,
      rewardRitual: Object.freeze({
        ...session.rewardRitual,
        acknowledged: true,
      }),
    });
  }
  return Object.freeze({
    id: session.id,
    sourceWorkflowId: session.sourceWorkflowId,
    snapshot: session.snapshot,
    currentPhaseIndex: session.currentPhaseIndex,
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + session.remainingMilliseconds,
    rewardRitual: Object.freeze({
      ...session.rewardRitual,
      acknowledged: true,
    }),
  });
}

function selectReward(
  session: Session,
  random: () => number,
  reroll: boolean,
  commandId?: string,
): PausedSession {
  if (
    session.status !== 'paused' ||
    session.pauseReason !== 'reward' ||
    session.rewardRitual === undefined
  ) {
    throw new SessionTransitionError();
  }
  const dice = session.snapshot.workflow.rewardDice;
  if (dice === undefined) throw new SessionTransitionError();
  const current = session.rewardRitual;
  if (reroll) {
    if (
      current.selectedSideIndex === undefined ||
      current.rerollsUsed >= dice.rerolls
    )
      throw new SessionTransitionError();
  } else if (current.selectedSideIndex !== undefined) {
    return session;
  }
  const selected = rollReward(
    session.snapshot.workflow,
    current.completedPhaseIndex,
    random,
  );
  const selectedSideIndex = dice.sides.indexOf(selected);
  if (selectedSideIndex < 0) throw new SessionTransitionError();
  return Object.freeze({
    ...session,
    rewardRitual: Object.freeze({
      ...current,
      selectedSideIndex,
      rerollsUsed: current.rerollsUsed + (reroll ? 1 : 0),
      ...(commandId === undefined ? {} : { lastCommandId: commandId }),
    }),
  });
}

export function rollSessionReward(
  session: Session,
  random: () => number,
  commandId?: string,
): PausedSession {
  return selectReward(session, random, false, commandId);
}

export function rerollSessionReward(
  session: Session,
  random: () => number,
  commandId?: string,
): PausedSession {
  return selectReward(session, random, true, commandId);
}

function validateRewardRitual(
  input: RestoreSessionInput,
  ritual: RewardRitual,
): void {
  const dice = input.workflow.rewardDice;
  const selected = ritual.selectedSideIndex;
  const validCompleted =
    Number.isInteger(ritual.completedPhaseIndex) &&
    ritual.completedPhaseIndex >= 0 &&
    ritual.completedPhaseIndex < input.workflow.phases.length;
  const validSelected =
    selected === undefined ||
    (Number.isInteger(selected) &&
      selected >= 0 &&
      dice !== undefined &&
      selected < dice.sides.length);
  const validRerolls =
    dice !== undefined &&
    Number.isInteger(ritual.rerollsUsed) &&
    ritual.rerollsUsed >= 0 &&
    ritual.rerollsUsed <= dice.rerolls &&
    (selected !== undefined || ritual.rerollsUsed === 0);
  const validTarget =
    ritual.continuation.type === 'complete'
      ? ritual.completedPhaseIndex === input.workflow.phases.length - 1 &&
        input.currentPhaseIndex === ritual.completedPhaseIndex
      : Number.isInteger(ritual.continuation.phaseIndex) &&
        ritual.continuation.phaseIndex === input.currentPhaseIndex &&
        ritual.continuation.phaseIndex === ritual.completedPhaseIndex + 1 &&
        input.workflow.phases[ritual.continuation.phaseIndex] !== undefined;
  if (
    !validCompleted ||
    ritual.id !== `${input.id}:${String(ritual.completedPhaseIndex)}` ||
    !validSelected ||
    !validRerolls ||
    !validTarget ||
    (input.status === 'paused' && ritual.acknowledged) ||
    (ritual.acknowledged && selected === undefined) ||
    ritual.lastCommandId?.trim() === ''
  ) {
    throw new SessionValidationError('Session Reward ritual is invalid.');
  }
}

export function stopSession(session: Session, now: number): StoppedSession {
  const reconciled = deriveSessionState(session, now);
  if (reconciled.status !== 'running' && reconciled.status !== 'paused') {
    throw new SessionTransitionError();
  }

  return Object.freeze({
    id: reconciled.id,
    sourceWorkflowId: reconciled.sourceWorkflowId,
    snapshot: reconciled.snapshot,
    currentPhaseIndex: reconciled.currentPhaseIndex,
    status: 'stopped',
    stoppedAt: now,
  });
}

export function getRemainingSeconds(session: Session, now: number): number {
  validateEpochMilliseconds(now);
  if (session.status === 'running') {
    return Math.max(0, Math.ceil((session.phaseEndsAt - now) / 1_000));
  }

  if (session.status === 'paused') {
    return Math.ceil(session.remainingMilliseconds / 1_000);
  }

  return 0;
}
