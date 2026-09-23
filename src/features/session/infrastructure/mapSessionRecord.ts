import { createWorkflow } from '@/features/workflow';

import {
  restoreSession,
  type RestoreSessionInput,
  type Session,
} from '../domain/Session';
import { SessionValidationError } from '../domain/SessionErrors';
import type { SessionRecord } from './SessionRecord';

type SessionSchemaVersion = 1 | 2 | 3 | 4 | 5;

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

function sideAvailability(value: unknown): 'any' | 'early' | 'late' {
  if (value === 'any' || value === 'early' || value === 'late') return value;
  return invalid();
}

function storedPauseReason(value: unknown): 'user' | 'reward' {
  if (value === undefined || value === 'user') return 'user';
  if (value === 'reward') return 'reward';
  return invalid();
}

function hasOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    hasOnlyKeys(value, [...required, ...optional])
  );
}

function parseWorkflow(value: unknown, schemaVersion: SessionSchemaVersion) {
  const input = record(value);
  const phases = input['phases'];
  if (!Array.isArray(phases)) return invalid();
  const rewardValue = input['rewardDice'];
  const reward = rewardValue === undefined ? undefined : record(rewardValue);
  const sides = reward?.['sides'];
  const rerolls =
    reward?.['rerolls'] === undefined ? undefined : number(reward['rerolls']);
  if (reward !== undefined && !Array.isArray(sides)) return invalid();
  const schedule = (() => {
    if (reward === undefined) return undefined;
    if (schemaVersion < 3) {
      if (
        !hasExactKeys(
          reward,
          ['frequency', 'sides'],
          ['triggerPhaseType', 'rerolls'],
        )
      )
        return invalid();
      const triggerPhaseType = optionalRewardPhaseType(
        reward['triggerPhaseType'],
      );
      return {
        type: 'frequency' as const,
        triggerPhaseType: triggerPhaseType ?? 'focus',
        frequency: number(reward['frequency']),
      };
    }
    if (
      !hasExactKeys(
        reward,
        schemaVersion === 5
          ? ['schedule', 'sides', 'rerolls']
          : ['schedule', 'sides'],
        schemaVersion === 5 ? [] : ['rerolls'],
      )
    )
      return invalid();
    const raw = record(reward['schedule']);
    if (
      raw['type'] === 'frequency' &&
      hasExactKeys(raw, ['type', 'triggerPhaseType', 'frequency'])
    ) {
      const triggerPhaseType = optionalRewardPhaseType(raw['triggerPhaseType']);
      if (triggerPhaseType === undefined) return invalid();
      return {
        type: 'frequency' as const,
        triggerPhaseType,
        frequency: number(raw['frequency']),
      };
    }
    if (
      raw['type'] === 'custom' &&
      hasExactKeys(raw, ['type', 'phaseIndexes']) &&
      Array.isArray(raw['phaseIndexes'])
    ) {
      return {
        type: 'custom' as const,
        phaseIndexes: raw['phaseIndexes'].map(number),
      };
    }
    return invalid();
  })();

  return createWorkflow({
    id: string(input['id']),
    name: string(input['name']),
    phases: phases.map((phaseValue) => {
      const phase = record(phaseValue);
      const environment = record(phase['environment']);
      const allowedEnvironmentKeys =
        schemaVersion === 1
          ? ['backgroundAssetId', 'audioAssetId', 'backgroundColor']
          : ['backgroundAsset', 'audioAsset', 'backgroundColor'];
      if (!hasOnlyKeys(environment, allowedEnvironmentKeys)) return invalid();
      const backgroundAssetId = optionalString(
        schemaVersion === 1 ? environment['backgroundAssetId'] : undefined,
      );
      const audioAssetId = optionalString(
        schemaVersion === 1 ? environment['audioAssetId'] : undefined,
      );
      const parseReference = (value: unknown) => {
        const reference = record(value);
        const keys = Object.keys(reference);
        if (
          reference['type'] !== 'direct' ||
          keys.length !== 2 ||
          !keys.includes('type') ||
          !keys.includes('assetId')
        ) {
          return invalid();
        }
        return {
          type: 'direct' as const,
          assetId: string(reference['assetId']),
        };
      };
      const backgroundAsset =
        schemaVersion === 1 || environment['backgroundAsset'] === undefined
          ? undefined
          : parseReference(environment['backgroundAsset']);
      const audioAsset =
        schemaVersion === 1 || environment['audioAsset'] === undefined
          ? undefined
          : parseReference(environment['audioAsset']);
      const backgroundColor = optionalString(environment['backgroundColor']);
      return {
        type: string(phase['type']),
        durationSeconds: number(phase['durationSeconds']),
        environment: {
          ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
          ...(audioAssetId === undefined ? {} : { audioAssetId }),
          ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
          ...(audioAsset === undefined ? {} : { audioAsset }),
          ...(backgroundColor === undefined ? {} : { backgroundColor }),
        },
      };
    }),
    ...(reward === undefined
      ? {}
      : {
          rewardDice: {
            schedule: schedule ?? invalid(),
            ...(rerolls === undefined ? {} : { rerolls }),
            sides: (sides as unknown[]).map((sideValue) => {
              const side = record(sideValue);
              const description = optionalString(side['description']);
              const required = ['icon', 'title', 'probability'];
              if (
                !hasExactKeys(
                  side,
                  schemaVersion < 4 ? required : [...required, 'availability'],
                  ['description'],
                )
              ) {
                return invalid();
              }
              return {
                icon: string(side['icon']),
                title: string(side['title']),
                ...(description === undefined ? {} : { description }),
                weight: number(side['probability']),
                availability:
                  schemaVersion < 4
                    ? 'any'
                    : sideAvailability(side['availability']),
              };
            }),
          },
        }),
  });
}

function parseRewardRitual(value: unknown) {
  if (value === undefined) return undefined;
  const ritual = record(value);
  const continuation = record(ritual['continuation']);
  if (
    !hasExactKeys(
      ritual,
      [
        'id',
        'completedPhaseIndex',
        'rerollsUsed',
        'acknowledged',
        'continuation',
      ],
      ['selectedSideIndex'],
    ) ||
    typeof ritual['acknowledged'] !== 'boolean'
  )
    return invalid();
  const parsedContinuation =
    continuation['type'] === 'complete' && hasExactKeys(continuation, ['type'])
      ? ({ type: 'complete' } as const)
      : continuation['type'] === 'phase' &&
          hasExactKeys(continuation, ['type', 'phaseIndex'])
        ? ({
            type: 'phase',
            phaseIndex: number(continuation['phaseIndex']),
          } as const)
        : invalid();
  return {
    id: string(ritual['id']),
    completedPhaseIndex: number(ritual['completedPhaseIndex']),
    ...(ritual['selectedSideIndex'] === undefined
      ? {}
      : { selectedSideIndex: number(ritual['selectedSideIndex']) }),
    rerollsUsed: number(ritual['rerollsUsed']),
    acknowledged: ritual['acknowledged'],
    continuation: parsedContinuation,
  };
}

function parseRewardCommandReceipts(value: unknown) {
  if (!Array.isArray(value)) return invalid();
  return value.map((entry) => {
    const receipt = record(entry);
    if (!hasExactKeys(receipt, ['commandId', 'type', 'rewardRitualId']))
      return invalid();
    const type = receipt['type'];
    if (type !== 'roll' && type !== 'reroll' && type !== 'continue')
      return invalid();
    return {
      commandId: string(receipt['commandId']),
      type,
      rewardRitualId: string(receipt['rewardRitualId']),
    } as const;
  });
}

export function mapSessionRecord(value: unknown): Session {
  const outer = record(value);
  if (
    (outer['schemaVersion'] !== 1 &&
      outer['schemaVersion'] !== 2 &&
      outer['schemaVersion'] !== 3 &&
      outer['schemaVersion'] !== 4 &&
      outer['schemaVersion'] !== 5) ||
    (outer['active'] !== 0 && outer['active'] !== 1)
  ) {
    return invalid();
  }
  number(outer['updatedAt']);
  const stored = record(outer['session']);
  const status = stored['status'];
  const rewardRitual =
    outer['schemaVersion'] < 5
      ? undefined
      : parseRewardRitual(stored['rewardRitual']);
  const rewardCommandReceipts =
    outer['schemaVersion'] < 5
      ? []
      : parseRewardCommandReceipts(stored['rewardCommandReceipts']);
  const common = {
    id: string(stored['id']),
    workflow: parseWorkflow(stored['workflow'], outer['schemaVersion']),
    currentPhaseIndex: number(stored['currentPhaseIndex']),
    rewardCommandReceipts,
    ...(rewardRitual === undefined ? {} : { rewardRitual }),
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
    const pauseReason = storedPauseReason(stored['pauseReason']);
    const remainingMilliseconds = number(stored['remainingMilliseconds']);
    const currentPhaseIndex = common.currentPhaseIndex;
    const restoredRitual =
      pauseReason !== 'reward' || rewardRitual !== undefined
        ? rewardRitual
        : outer['schemaVersion'] === 5
          ? invalid()
          : remainingMilliseconds === 0
            ? {
                id: `${common.id}:${String(currentPhaseIndex)}`,
                completedPhaseIndex: currentPhaseIndex,
                rerollsUsed: 0,
                acknowledged: false,
                continuation: { type: 'complete' as const },
              }
            : {
                id: `${common.id}:${String(Math.max(0, currentPhaseIndex - 1))}`,
                completedPhaseIndex: Math.max(0, currentPhaseIndex - 1),
                rerollsUsed: 0,
                acknowledged: false,
                continuation: {
                  type: 'phase' as const,
                  phaseIndex: currentPhaseIndex,
                },
              };
    input = {
      ...common,
      status,
      pauseReason,
      pausedAt: number(stored['pausedAt']),
      remainingMilliseconds,
      ...(restoredRitual === undefined ? {} : { rewardRitual: restoredRitual }),
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
    schemaVersion: 5,
    active,
    updatedAt,
    session: {
      id: session.id,
      workflow: session.snapshot.workflow,
      currentPhaseIndex: session.currentPhaseIndex,
      rewardCommandReceipts: session.rewardCommandReceipts,
      status: session.status,
      ...(session.rewardRitual === undefined
        ? {}
        : { rewardRitual: session.rewardRitual }),
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
