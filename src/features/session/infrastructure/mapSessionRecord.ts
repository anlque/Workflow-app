import { createWorkflow } from '@/features/workflow';

import {
  restoreSession,
  type RestoreSessionInput,
  type Session,
} from '../domain/Session';
import { SessionValidationError } from '../domain/SessionErrors';
import type { SessionRecord } from './SessionRecord';

function invalid(): never {
  throw new SessionValidationError('Stored Session record is invalid.');
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return invalid();
  return value as Readonly<Record<string, unknown>>;
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : invalid();
}

function number(value: unknown): number {
  return typeof value === 'number' ? value : invalid();
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : string(value);
}

function optionalRewardPhaseType(
  value: unknown,
): 'focus' | 'break' | undefined {
  if (value === undefined) return undefined;
  if (value === 'focus' || value === 'break') return value;
  return invalid();
}

function storedPauseReason(value: unknown): 'user' | 'reward' {
  if (value === undefined || value === 'user') return 'user';
  if (value === 'reward') return 'reward';
  return invalid();
}

function parseWorkflow(value: unknown) {
  const input = record(value);
  const phases = input['phases'];
  if (!Array.isArray(phases)) return invalid();
  const rewardValue = input['rewardDice'];
  const reward = rewardValue === undefined ? undefined : record(rewardValue);
  const sides = reward?.['sides'];
  const triggerPhaseType = optionalRewardPhaseType(
    reward?.['triggerPhaseType'],
  );
  const rerolls =
    reward?.['rerolls'] === undefined ? undefined : number(reward['rerolls']);
  if (reward !== undefined && !Array.isArray(sides)) return invalid();

  return createWorkflow({
    id: string(input['id']),
    name: string(input['name']),
    phases: phases.map((phaseValue) => {
      const phase = record(phaseValue);
      const environment = record(phase['environment']);
      const backgroundAssetId = optionalString(
        environment['backgroundAssetId'],
      );
      const audioAssetId = optionalString(environment['audioAssetId']);
      const backgroundColor = optionalString(environment['backgroundColor']);
      return {
        type: string(phase['type']),
        durationSeconds: number(phase['durationSeconds']),
        environment: {
          ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
          ...(audioAssetId === undefined ? {} : { audioAssetId }),
          ...(backgroundColor === undefined ? {} : { backgroundColor }),
        },
      };
    }),
    ...(reward === undefined
      ? {}
      : {
          rewardDice: {
            ...(triggerPhaseType === undefined ? {} : { triggerPhaseType }),
            frequency: number(reward['frequency']),
            ...(rerolls === undefined ? {} : { rerolls }),
            sides: (sides as unknown[]).map((sideValue) => {
              const side = record(sideValue);
              const description = optionalString(side['description']);
              return {
                icon: string(side['icon']),
                title: string(side['title']),
                ...(description === undefined ? {} : { description }),
                weight: number(side['probability']),
              };
            }),
          },
        }),
  });
}

export function mapSessionRecord(value: unknown): Session {
  const outer = record(value);
  if (
    outer['schemaVersion'] !== 1 ||
    (outer['active'] !== 0 && outer['active'] !== 1)
  ) {
    return invalid();
  }
  number(outer['updatedAt']);
  const stored = record(outer['session']);
  const status = stored['status'];
  const common = {
    id: string(stored['id']),
    workflow: parseWorkflow(stored['workflow']),
    currentPhaseIndex: number(stored['currentPhaseIndex']),
  };

  let input: RestoreSessionInput;
  if (status === 'running') {
    input = {
      ...common,
      status,
      phaseStartedAt: number(stored['phaseStartedAt']),
      phaseEndsAt: number(stored['phaseEndsAt']),
    };
  } else if (status === 'transitioning') {
    input = {
      ...common,
      status,
      transitionEndsAt: number(stored['transitionEndsAt']),
    };
  } else if (status === 'paused') {
    input = {
      ...common,
      status,
      pauseReason: storedPauseReason(stored['pauseReason']),
      pausedAt: number(stored['pausedAt']),
      remainingMilliseconds: number(stored['remainingMilliseconds']),
    };
  } else if (status === 'completed') {
    input = { ...common, status, completedAt: number(stored['completedAt']) };
  } else if (status === 'stopped') {
    input = { ...common, status, stoppedAt: number(stored['stoppedAt']) };
  } else {
    return invalid();
  }
  const session = restoreSession(input);
  const expectedActive =
    session.status === 'running' ||
    session.status === 'transitioning' ||
    session.status === 'paused'
      ? 1
      : 0;
  if (outer['active'] !== expectedActive || outer['id'] !== session.id)
    return invalid();
  return session;
}

export function mapSessionToRecord(session: Session): SessionRecord {
  const active =
    session.status === 'running' ||
    session.status === 'transitioning' ||
    session.status === 'paused'
      ? 1
      : 0;
  const updatedAt =
    session.status === 'running'
      ? session.phaseStartedAt
      : session.status === 'transitioning'
        ? session.transitionEndsAt
        : session.status === 'paused'
          ? session.pausedAt
          : session.status === 'completed'
            ? session.completedAt
            : session.stoppedAt;
  return {
    id: session.id,
    schemaVersion: 1,
    active,
    updatedAt,
    session: {
      id: session.id,
      workflow: session.snapshot.workflow,
      currentPhaseIndex: session.currentPhaseIndex,
      status: session.status,
      ...(session.status === 'running'
        ? {
            phaseStartedAt: session.phaseStartedAt,
            phaseEndsAt: session.phaseEndsAt,
          }
        : session.status === 'transitioning'
          ? { transitionEndsAt: session.transitionEndsAt }
          : session.status === 'paused'
            ? {
                pauseReason: session.pauseReason,
                pausedAt: session.pausedAt,
                remainingMilliseconds: session.remainingMilliseconds,
              }
            : session.status === 'completed'
              ? { completedAt: session.completedAt }
              : { stoppedAt: session.stoppedAt }),
    },
  };
}
