import { createWorkflow } from '@/features/workflow';

import {
  restoreSession,
  type RestoreSessionInput,
  type Session,
} from '../domain/Session';
import { SessionValidationError } from '../domain/SessionErrors';

function invalid(): never {
  throw new SessionValidationError('Session projection is invalid.');
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid();
  }
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

function pauseReason(value: unknown): 'user' | 'reward' {
  if (value === 'user' || value === 'reward') return value;
  return invalid();
}

function workflow(value: unknown) {
  const input = record(value);
  const phases = input['phases'];
  if (!Array.isArray(phases)) return invalid();
  const diceValue = input['rewardDice'];
  const dice = diceValue === undefined ? undefined : record(diceValue);
  const sides = dice?.['sides'];
  if (dice !== undefined && !Array.isArray(sides)) return invalid();
  return createWorkflow({
    id: string(input['id']),
    name: string(input['name']),
    phases: phases.map((value) => {
      const phase = record(value);
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
    ...(dice === undefined
      ? {}
      : {
          rewardDice: {
            frequency: number(dice['frequency']),
            sides: (sides as unknown[]).map((value) => {
              const side = record(value);
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

export function parseSessionProjection(value: unknown): Session | null {
  if (value === null) return null;
  const input = record(value);
  const snapshot = record(input['snapshot']);
  const common = {
    id: string(input['id']),
    workflow: workflow(snapshot['workflow']),
    currentPhaseIndex: number(input['currentPhaseIndex']),
  };
  const status = input['status'];
  let restored: RestoreSessionInput;
  if (status === 'running') {
    restored = {
      ...common,
      status,
      phaseStartedAt: number(input['phaseStartedAt']),
      phaseEndsAt: number(input['phaseEndsAt']),
    };
  } else if (status === 'transitioning') {
    restored = {
      ...common,
      status,
      transitionEndsAt: number(input['transitionEndsAt']),
    };
  } else if (status === 'paused') {
    restored = {
      ...common,
      status,
      pauseReason: pauseReason(input['pauseReason']),
      pausedAt: number(input['pausedAt']),
      remainingMilliseconds: number(input['remainingMilliseconds']),
    };
  } else if (status === 'completed') {
    restored = { ...common, status, completedAt: number(input['completedAt']) };
  } else if (status === 'stopped') {
    restored = { ...common, status, stoppedAt: number(input['stoppedAt']) };
  } else {
    return invalid();
  }
  return restoreSession(restored);
}
