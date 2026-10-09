import {
  eligibleDiceSides,
  isRewardDueAfterPhase,
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
  rewardCommandReceipts: readonly RewardCommandReceipt[];
  restartCommandReceipts: readonly RestartCommandReceipt[];
  rewardRitual?: RewardRitual;
  activeBonusPhase?: ActiveBonusRewardPhase;
}>;

export type ActiveBonusRewardPhase = Readonly<{
  rewardRitualId: string;
  selectedSideIndex: number;
}>;

export type RewardContinuationTarget =
  | Readonly<{ type: 'phase'; phaseIndex: number }>
  | Readonly<{ type: 'complete' }>;

export type RewardCommandReceipt = Readonly<{
  commandId: string;
  type: 'roll' | 'reroll' | 'continue' | 'restart';
  rewardRitualId: string;
}>;

export const MAX_REWARD_COMMAND_RECEIPTS = 16;
export const MAX_RESTART_COMMAND_RECEIPTS = 16;

export type RestartPhaseTarget =
  | Readonly<{ type: 'phase'; phaseIndex: number }>
  | Readonly<{ type: 'bonus'; rewardRitualId: string }>;

export type RestartCommandReceipt =
  | Readonly<{
      commandId: string;
      type: 'restart-phase';
      target: RestartPhaseTarget;
    }>
  | Readonly<{ commandId: string; type: 'restart-workflow' }>;

export type RewardRitual = Readonly<{
  id: string;
  completedPhaseIndex: number;
  selectedSideIndex?: number;
  rerollsUsed: number;
  acknowledged: boolean;
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
      rewardCommandReceipts: readonly RewardCommandReceipt[];
      restartCommandReceipts: readonly RestartCommandReceipt[];
      rewardRitual?: RewardRitual;
      activeBonusPhase?: ActiveBonusRewardPhase;
      status: 'running';
      phaseStartedAt: number;
      phaseEndsAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardCommandReceipts: readonly RewardCommandReceipt[];
      restartCommandReceipts: readonly RestartCommandReceipt[];
      rewardRitual?: RewardRitual;
      activeBonusPhase?: ActiveBonusRewardPhase;
      status: 'transitioning';
      transitionEndsAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardCommandReceipts: readonly RewardCommandReceipt[];
      restartCommandReceipts: readonly RestartCommandReceipt[];
      rewardRitual?: RewardRitual;
      activeBonusPhase?: ActiveBonusRewardPhase;
      status: 'paused';
      pauseReason?: 'user' | 'reward';
      pausedAt: number;
      remainingMilliseconds: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardCommandReceipts: readonly RewardCommandReceipt[];
      restartCommandReceipts: readonly RestartCommandReceipt[];
      rewardRitual?: RewardRitual;
      activeBonusPhase?: ActiveBonusRewardPhase;
      status: 'completed';
      completedAt: number;
    }>
  | Readonly<{
      id: string;
      workflow: Workflow;
      currentPhaseIndex: number;
      rewardCommandReceipts: readonly RewardCommandReceipt[];
      restartCommandReceipts: readonly RestartCommandReceipt[];
      rewardRitual?: RewardRitual;
      activeBonusPhase?: ActiveBonusRewardPhase;
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
    rewardCommandReceipts: Object.freeze([]),
    restartCommandReceipts: Object.freeze([]),
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

  const rewardCommandReceipts = input.rewardCommandReceipts;
  validateRewardCommandReceipts(rewardCommandReceipts);
  validateRestartCommandReceipts(input.restartCommandReceipts);
  if (
    input.restartCommandReceipts.some((restartReceipt) =>
      rewardCommandReceipts.some(
        (rewardReceipt) => rewardReceipt.commandId === restartReceipt.commandId,
      ),
    )
  )
    throw new SessionValidationError('Session command receipts are invalid.');
  validateActiveBonusPhase(input);
  if (input.rewardRitual !== undefined) {
    validateRewardRitual(input, input.rewardRitual, rewardCommandReceipts);
  }

  const base = {
    id: createSessionId(input.id),
    sourceWorkflowId: input.workflow.id,
    snapshot: createSessionSnapshot(input.workflow),
    currentPhaseIndex: input.currentPhaseIndex,
    rewardCommandReceipts: freezeRewardCommandReceipts(rewardCommandReceipts),
    restartCommandReceipts: freezeRestartCommandReceipts(
      input.restartCommandReceipts,
    ),
    ...(input.rewardRitual === undefined
      ? {}
      : { rewardRitual: freezeRewardRitual(input.rewardRitual) }),
    ...(input.activeBonusPhase === undefined
      ? {}
      : { activeBonusPhase: freezeActiveBonusPhase(input.activeBonusPhase) }),
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
      input.remainingMilliseconds < 0 ||
      (input.remainingMilliseconds === 0 && input.pauseReason !== 'reward')
    ) {
      throw new SessionValidationError(
        'Paused Session remaining time is invalid.',
      );
    }
    const rewardRitual = input.rewardRitual;
    if (input.pauseReason === 'reward' && rewardRitual === undefined) {
      throw new SessionValidationError('Session Reward ritual is invalid.');
    }
    return Object.freeze({
      ...base,
      status: input.status,
      pauseReason: input.pauseReason ?? 'user',
      pausedAt: input.pausedAt,
      remainingMilliseconds: input.remainingMilliseconds,
      ...(rewardRitual === undefined
        ? {}
        : { rewardRitual: freezeRewardRitual(rewardRitual) }),
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
    rewardCommandReceipts: reconciled.rewardCommandReceipts,
    restartCommandReceipts: reconciled.restartCommandReceipts,
    ...(reconciled.rewardRitual === undefined
      ? {}
      : { rewardRitual: reconciled.rewardRitual }),
    ...(reconciled.activeBonusPhase === undefined
      ? {}
      : { activeBonusPhase: reconciled.activeBonusPhase }),
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
    rewardCommandReceipts: session.rewardCommandReceipts,
    restartCommandReceipts: session.restartCommandReceipts,
    ...(session.rewardRitual === undefined
      ? {}
      : { rewardRitual: session.rewardRitual }),
    ...(session.activeBonusPhase === undefined
      ? {}
      : { activeBonusPhase: session.activeBonusPhase }),
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + session.remainingMilliseconds,
  });
}

export function continueRewardSession(
  session: Session,
  now: number,
  commandId: string,
): RunningSession | CompletedSession {
  validateEpochMilliseconds(now);
  if (
    session.status !== 'paused' ||
    session.pauseReason !== 'reward' ||
    session.rewardRitual?.selectedSideIndex === undefined
  ) {
    throw new SessionTransitionError();
  }
  const selectedSide =
    session.snapshot.workflow.rewardDice?.sides[
      session.rewardRitual.selectedSideIndex
    ];
  const bonusPhase = selectedSide?.bonusPhase;
  if (bonusPhase !== undefined) {
    return Object.freeze({
      id: session.id,
      sourceWorkflowId: session.sourceWorkflowId,
      snapshot: session.snapshot,
      currentPhaseIndex: session.currentPhaseIndex,
      rewardCommandReceipts: appendRewardCommandReceipt(
        session.rewardCommandReceipts,
        commandId,
        'continue',
        session.rewardRitual.id,
      ),
      restartCommandReceipts: session.restartCommandReceipts,
      status: 'running',
      phaseStartedAt: now,
      phaseEndsAt: now + bonusPhase.durationSeconds * 1_000,
      rewardRitual: freezeRewardRitual({
        ...session.rewardRitual,
        acknowledged: true,
      }),
      activeBonusPhase: freezeActiveBonusPhase({
        rewardRitualId: session.rewardRitual.id,
        selectedSideIndex: session.rewardRitual.selectedSideIndex,
      }),
    });
  }
  if (session.rewardRitual.continuation.type === 'complete') {
    return Object.freeze({
      id: session.id,
      sourceWorkflowId: session.sourceWorkflowId,
      snapshot: session.snapshot,
      currentPhaseIndex: session.currentPhaseIndex,
      rewardCommandReceipts: appendRewardCommandReceipt(
        session.rewardCommandReceipts,
        commandId,
        'continue',
        session.rewardRitual.id,
      ),
      restartCommandReceipts: session.restartCommandReceipts,
      status: 'completed',
      completedAt: now,
      rewardRitual: freezeRewardRitual({
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
    rewardCommandReceipts: appendRewardCommandReceipt(
      session.rewardCommandReceipts,
      commandId,
      'continue',
      session.rewardRitual.id,
    ),
    restartCommandReceipts: session.restartCommandReceipts,
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + session.remainingMilliseconds,
    rewardRitual: freezeRewardRitual({
      ...session.rewardRitual,
      acknowledged: true,
    }),
  });
}

export function restartSessionPhase(
  session: Session,
  now: number,
  commandId: string,
  target: RestartPhaseTarget,
): Session {
  validateEpochMilliseconds(now);
  if (
    commandId.trim() === '' ||
    session.rewardCommandReceipts.some(
      (receipt) => receipt.commandId === commandId,
    )
  )
    throw new SessionTransitionError();
  const duplicate = findRestartCommandReceipt(session, commandId);
  if (duplicate !== undefined) {
    if (
      duplicate.type === 'restart-phase' &&
      restartTargetsEqual(duplicate.target, target)
    ) {
      return session;
    }
    throw new SessionTransitionError();
  }
  if (
    session.status !== 'running' &&
    !(session.status === 'paused' && session.pauseReason === 'user')
  ) {
    throw new SessionTransitionError();
  }
  const durationSeconds = (() => {
    if (target.type === 'phase') {
      if (
        session.activeBonusPhase !== undefined ||
        target.phaseIndex !== session.currentPhaseIndex
      )
        throw new SessionTransitionError();
      const phase = session.snapshot.workflow.phases[target.phaseIndex];
      if (phase === undefined) throw new SessionTransitionError();
      return phase.durationSeconds;
    }
    if (
      session.activeBonusPhase?.rewardRitualId !== target.rewardRitualId ||
      session.rewardRitual === undefined
    )
      throw new SessionTransitionError();
    const bonus =
      session.snapshot.workflow.rewardDice?.sides[
        session.activeBonusPhase.selectedSideIndex
      ]?.bonusPhase;
    if (bonus === undefined) throw new SessionTransitionError();
    return bonus.durationSeconds;
  })();
  return Object.freeze({
    id: session.id,
    sourceWorkflowId: session.sourceWorkflowId,
    snapshot: session.snapshot,
    currentPhaseIndex: session.currentPhaseIndex,
    rewardCommandReceipts: session.rewardCommandReceipts,
    restartCommandReceipts: appendRestartCommandReceipt(
      session.restartCommandReceipts,
      { commandId, type: 'restart-phase', target },
    ),
    ...(session.rewardRitual === undefined
      ? {}
      : { rewardRitual: session.rewardRitual }),
    ...(session.activeBonusPhase === undefined
      ? {}
      : { activeBonusPhase: session.activeBonusPhase }),
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + durationSeconds * 1_000,
  });
}

export function restartSessionWorkflow(
  session: Session,
  now: number,
  commandId: string,
): Session {
  validateEpochMilliseconds(now);
  if (
    commandId.trim() === '' ||
    session.rewardCommandReceipts.some(
      (receipt) => receipt.commandId === commandId,
    )
  )
    throw new SessionTransitionError();
  const duplicate = findRestartCommandReceipt(session, commandId);
  if (duplicate !== undefined) {
    if (duplicate.type === 'restart-workflow') {
      return session;
    }
    throw new SessionTransitionError();
  }
  if (
    session.status !== 'running' &&
    !(session.status === 'paused' && session.pauseReason === 'user')
  )
    throw new SessionTransitionError();
  const firstPhase = session.snapshot.workflow.phases[0];
  return Object.freeze({
    id: session.id,
    sourceWorkflowId: session.sourceWorkflowId,
    snapshot: session.snapshot,
    currentPhaseIndex: 0,
    rewardCommandReceipts: Object.freeze([]),
    restartCommandReceipts: appendRestartCommandReceipt(
      session.restartCommandReceipts,
      { commandId, type: 'restart-workflow' },
    ),
    status: 'running',
    phaseStartedAt: now,
    phaseEndsAt: now + firstPhase.durationSeconds * 1_000,
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
    rewardCommandReceipts: appendRewardCommandReceipt(
      session.rewardCommandReceipts,
      commandId,
      reroll ? 'reroll' : 'roll',
      current.id,
    ),
    restartCommandReceipts: session.restartCommandReceipts,
    rewardRitual: freezeRewardRitual({
      ...current,
      selectedSideIndex,
      rerollsUsed: current.rerollsUsed + (reroll ? 1 : 0),
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
  rewardCommandReceipts: readonly RewardCommandReceipt[],
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
  const selectedSide =
    selected === undefined || dice === undefined
      ? undefined
      : dice.sides[selected];
  const rewardIsDue =
    validCompleted &&
    isRewardDueAfterPhase(input.workflow, ritual.completedPhaseIndex);
  const validEligibility =
    rewardIsDue &&
    (selectedSide === undefined ||
      eligibleDiceSides(input.workflow, ritual.completedPhaseIndex).includes(
        selectedSide,
      ));
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
  const activeBonus = input.activeBonusPhase;
  const validState =
    input.status === 'paused'
      ? input.pauseReason === 'reward'
        ? !ritual.acknowledged && activeBonus === undefined
        : ritual.acknowledged &&
          (activeBonus !== undefined || ritual.continuation.type === 'phase')
      : input.status === 'running'
        ? ritual.acknowledged &&
          (activeBonus !== undefined || ritual.continuation.type === 'phase')
        : input.status === 'completed'
          ? ritual.acknowledged && ritual.continuation.type === 'complete'
          : false;
  if (
    !validCompleted ||
    ritual.id !== `${input.id}:${String(ritual.completedPhaseIndex)}` ||
    !validSelected ||
    !validEligibility ||
    !validRerolls ||
    !validTarget ||
    !validState ||
    (ritual.acknowledged && selected === undefined) ||
    (ritual.acknowledged &&
      !rewardCommandReceipts.some(
        ({ type, rewardRitualId }) =>
          type === 'continue' && rewardRitualId === ritual.id,
      ))
  ) {
    throw new SessionValidationError('Session Reward ritual is invalid.');
  }
}

function validateActiveBonusPhase(input: RestoreSessionInput): void {
  const active = input.activeBonusPhase;
  if (active === undefined) return;
  const ritual = input.rewardRitual;
  const side = input.workflow.rewardDice?.sides[active.selectedSideIndex];
  if (
    (input.status !== 'running' &&
      !(input.status === 'paused' && input.pauseReason === 'user')) ||
    ritual === undefined ||
    !ritual.acknowledged ||
    ritual.id !== active.rewardRitualId ||
    ritual.selectedSideIndex !== active.selectedSideIndex ||
    side?.bonusPhase === undefined
  ) {
    throw new SessionValidationError('Session Bonus Reward Phase is invalid.');
  }
}

function validateRewardCommandReceipts(
  receipts: readonly RewardCommandReceipt[],
): void {
  if (
    receipts.length > MAX_REWARD_COMMAND_RECEIPTS ||
    new Set(receipts.map(({ commandId }) => commandId)).size !==
      receipts.length ||
    receipts.some((receipt) => {
      const type: unknown = receipt.type;
      return (
        receipt.commandId.trim() === '' ||
        receipt.rewardRitualId.trim() === '' ||
        (type !== 'roll' &&
          type !== 'reroll' &&
          type !== 'continue' &&
          type !== 'restart')
      );
    })
  ) {
    throw new SessionValidationError('Session Reward receipts are invalid.');
  }
}

function validateRestartCommandReceipts(
  receipts: readonly RestartCommandReceipt[],
): void {
  if (
    receipts.length > MAX_RESTART_COMMAND_RECEIPTS ||
    new Set(receipts.map(({ commandId }) => commandId)).size !==
      receipts.length ||
    receipts.some((receipt) => {
      if (receipt.commandId.trim() === '') return true;
      if (receipt.type === 'restart-workflow') return false;
      return receipt.target.type === 'phase'
        ? !Number.isInteger(receipt.target.phaseIndex) ||
            receipt.target.phaseIndex < 0
        : receipt.target.rewardRitualId.trim() === '';
    })
  )
    throw new SessionValidationError('Session restart receipts are invalid.');
}

function findRestartCommandReceipt(
  session: Session,
  commandId: string,
): RestartCommandReceipt | undefined {
  return session.restartCommandReceipts.find(
    (receipt) => receipt.commandId === commandId,
  );
}

function restartTargetsEqual(
  left: RestartPhaseTarget,
  right: RestartPhaseTarget,
): boolean {
  return left.type === 'phase' && right.type === 'phase'
    ? left.phaseIndex === right.phaseIndex
    : left.type === 'bonus' && right.type === 'bonus'
      ? left.rewardRitualId === right.rewardRitualId
      : false;
}

function appendRestartCommandReceipt(
  receipts: readonly RestartCommandReceipt[],
  receipt: RestartCommandReceipt,
): readonly RestartCommandReceipt[] {
  return freezeRestartCommandReceipts(
    [...receipts, receipt].slice(-MAX_RESTART_COMMAND_RECEIPTS),
  );
}

function appendRewardCommandReceipt(
  receipts: readonly RewardCommandReceipt[],
  commandId: string | undefined,
  type: RewardCommandReceipt['type'],
  rewardRitualId: string,
): readonly RewardCommandReceipt[] {
  if (commandId === undefined) return receipts;
  return freezeRewardCommandReceipts(
    [...receipts, { commandId, type, rewardRitualId }].slice(
      -MAX_REWARD_COMMAND_RECEIPTS,
    ),
  );
}

function freezeRewardRitual(ritual: RewardRitual): RewardRitual {
  return Object.freeze({
    ...ritual,
    continuation: Object.freeze({ ...ritual.continuation }),
  });
}

function freezeActiveBonusPhase(
  active: ActiveBonusRewardPhase,
): ActiveBonusRewardPhase {
  return Object.freeze({ ...active });
}

function freezeRewardCommandReceipts(
  receipts: readonly RewardCommandReceipt[],
): readonly RewardCommandReceipt[] {
  return Object.freeze(
    receipts.map((receipt) => Object.freeze({ ...receipt })),
  );
}

function freezeRestartCommandReceipts(
  receipts: readonly RestartCommandReceipt[],
): readonly RestartCommandReceipt[] {
  return Object.freeze(
    receipts.map((receipt) =>
      Object.freeze(
        receipt.type === 'restart-phase'
          ? { ...receipt, target: Object.freeze({ ...receipt.target }) }
          : { ...receipt },
      ),
    ),
  );
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
    rewardCommandReceipts: reconciled.rewardCommandReceipts,
    restartCommandReceipts: reconciled.restartCommandReceipts,
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
