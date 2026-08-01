import type { Workflow, WorkflowId } from '@/features/workflow';

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
}>;

export type RunningSession = SessionBase &
  Readonly<{
    status: 'running';
    phaseStartedAt: number;
    phaseEndsAt: number;
  }>;

export type PausedSession = SessionBase &
  Readonly<{
    status: 'paused';
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
  RunningSession | PausedSession | CompletedSession | StoppedSession;

export type RestoreSessionInput =
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      status: 'running';
      phaseStartedAt: number;
      phaseEndsAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      status: 'paused';
      pausedAt: number;
      remainingMilliseconds: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      status: 'completed';
      completedAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
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
  };

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
      input.remainingMilliseconds <= 0
    ) {
      throw new SessionValidationError(
        'Paused Session remaining time is invalid.',
      );
    }
    return Object.freeze({
      ...base,
      status: input.status,
      pausedAt: input.pausedAt,
      remainingMilliseconds: input.remainingMilliseconds,
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
    pausedAt: now,
    remainingMilliseconds: reconciled.phaseEndsAt - now,
  });
}

export function resumeSession(session: Session, now: number): RunningSession {
  validateEpochMilliseconds(now);
  if (session.status !== 'paused') {
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
