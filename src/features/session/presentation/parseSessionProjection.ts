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

function rewardPhaseType(value: unknown): 'focus' | 'break' {
  if (value === 'focus' || value === 'break') return value;
  return invalid();
}

function sideAvailability(value: unknown): 'any' | 'early' | 'late' {
  if (value === 'any' || value === 'early' || value === 'late') return value;
  return invalid();
}

function pauseReason(value: unknown): 'user' | 'reward' {
  if (value === 'user' || value === 'reward') return value;
  return invalid();
}

function rewardRitual(value: unknown) {
  if (value === undefined) return undefined;
  const input = record(value);
  const continuation = record(input['continuation']);
  if (
    !hasExactKeys(
      input,
      [
        'id',
        'completedPhaseIndex',
        'rerollsUsed',
        'acknowledged',
        'continuation',
      ],
      ['selectedSideIndex'],
    ) ||
    typeof input['acknowledged'] !== 'boolean'
  )
    return invalid();
  const target =
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
    id: string(input['id']),
    completedPhaseIndex: number(input['completedPhaseIndex']),
    ...(input['selectedSideIndex'] === undefined
      ? {}
      : { selectedSideIndex: number(input['selectedSideIndex']) }),
    rerollsUsed: number(input['rerollsUsed']),
    acknowledged: input['acknowledged'],
    continuation: target,
  };
}

function rewardCommandReceipts(value: unknown) {
  if (!Array.isArray(value)) return invalid();
  return value.map((entry) => {
    const receipt = record(entry);
    if (!hasExactKeys(receipt, ['commandId', 'type', 'rewardRitualId']))
      return invalid();
    const type = receipt['type'];
    if (
      type !== 'roll' &&
      type !== 'reroll' &&
      type !== 'continue' &&
      type !== 'restart'
    )
      return invalid();
    return {
      commandId: string(receipt['commandId']),
      type,
      rewardRitualId: string(receipt['rewardRitualId']),
    } as const;
  });
}

function activeBonusPhase(value: unknown) {
  if (value === undefined) return undefined;
  const active = record(value);
  if (!hasExactKeys(active, ['rewardRitualId', 'selectedSideIndex'])) {
    return invalid();
  }
  return {
    rewardRitualId: string(active['rewardRitualId']),
    selectedSideIndex: number(active['selectedSideIndex']),
  };
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function directReference(value: unknown) {
  const reference = record(value);
  if (
    reference['type'] !== 'direct' ||
    !hasExactKeys(reference, ['type', 'assetId'])
  ) {
    return invalid();
  }
  return {
    type: 'direct' as const,
    assetId: string(reference['assetId']),
  };
}

function environment(value: unknown) {
  const input = record(value);
  if (
    !hasExactKeys(
      input,
      [],
      ['backgroundAsset', 'audioAsset', 'backgroundColor'],
    )
  ) {
    return invalid();
  }
  const backgroundAsset =
    input['backgroundAsset'] === undefined
      ? undefined
      : directReference(input['backgroundAsset']);
  const audioAsset =
    input['audioAsset'] === undefined
      ? undefined
      : directReference(input['audioAsset']);
  const backgroundColor = optionalString(input['backgroundColor']);
  return {
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
  };
}

function workflow(value: unknown) {
  const input = record(value);
  if (!hasExactKeys(input, ['id', 'name', 'phases'], ['rewardDice']))
    return invalid();
  const phases = input['phases'];
  if (!Array.isArray(phases)) return invalid();
  const diceValue = input['rewardDice'];
  const dice = diceValue === undefined ? undefined : record(diceValue);
  const sides = dice?.['sides'];
  const rerolls = dice === undefined ? undefined : number(dice['rerolls']);
  if (
    dice !== undefined &&
    (!hasExactKeys(dice, ['schedule', 'rerolls', 'sides']) ||
      !Array.isArray(sides))
  )
    return invalid();
  const schedule = (() => {
    if (dice === undefined) return undefined;
    const raw = record(dice['schedule']);
    if (
      raw['type'] === 'frequency' &&
      hasExactKeys(raw, ['type', 'triggerPhaseType', 'frequency'])
    ) {
      return {
        type: 'frequency' as const,
        triggerPhaseType: rewardPhaseType(raw['triggerPhaseType']),
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
    phases: phases.map((value) => {
      const phase = record(value);
      if (!hasExactKeys(phase, ['type', 'durationSeconds', 'environment']))
        return invalid();
      return {
        type: string(phase['type']),
        durationSeconds: number(phase['durationSeconds']),
        environment: environment(phase['environment']),
      };
    }),
    ...(dice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: schedule ?? invalid(),
            rerolls: rerolls ?? invalid(),
            sides: (sides as unknown[]).map((value) => {
              const side = record(value);
              if (
                !hasExactKeys(
                  side,
                  ['icon', 'title', 'probability', 'availability'],
                  ['description', 'bonusPhase'],
                )
              )
                return invalid();
              const description = optionalString(side['description']);
              const bonusPhase = (() => {
                if (side['bonusPhase'] === undefined) return undefined;
                const bonus = record(side['bonusPhase']);
                if (
                  !hasExactKeys(bonus, [
                    'name',
                    'durationSeconds',
                    'environment',
                  ])
                ) {
                  return invalid();
                }
                return {
                  name: string(bonus['name']),
                  durationSeconds: number(bonus['durationSeconds']),
                  environment: environment(bonus['environment']),
                };
              })();
              return {
                icon: string(side['icon']),
                title: string(side['title']),
                ...(description === undefined ? {} : { description }),
                weight: number(side['probability']),
                availability: sideAvailability(side['availability']),
                ...(bonusPhase === undefined ? {} : { bonusPhase }),
              };
            }),
          },
        }),
  });
}

export function parseSessionProjection(value: unknown): Session | null {
  if (value === null) return null;
  const input = record(value);
  const status = input['status'];
  const statusKeys =
    status === 'running'
      ? ['phaseStartedAt', 'phaseEndsAt']
      : status === 'transitioning'
        ? ['transitionEndsAt']
        : status === 'paused'
          ? ['pauseReason', 'pausedAt', 'remainingMilliseconds']
          : status === 'completed'
            ? ['completedAt']
            : status === 'stopped'
              ? ['stoppedAt']
              : invalid();
  if (
    !hasExactKeys(
      input,
      [
        'id',
        'sourceWorkflowId',
        'snapshot',
        'currentPhaseIndex',
        'rewardCommandReceipts',
        'status',
        ...statusKeys,
      ],
      ['rewardRitual', 'activeBonusPhase'],
    )
  )
    return invalid();
  const snapshot = record(input['snapshot']);
  if (!hasExactKeys(snapshot, ['workflow'])) return invalid();
  const restoredWorkflow = workflow(snapshot['workflow']);
  if (string(input['sourceWorkflowId']) !== restoredWorkflow.id)
    return invalid();
  const ritual = rewardRitual(input['rewardRitual']);
  const activeBonus = activeBonusPhase(input['activeBonusPhase']);
  const common = {
    id: string(input['id']),
    workflow: restoredWorkflow,
    currentPhaseIndex: number(input['currentPhaseIndex']),
    rewardCommandReceipts: rewardCommandReceipts(
      input['rewardCommandReceipts'],
    ),
    ...(ritual === undefined ? {} : { rewardRitual: ritual }),
    ...(activeBonus === undefined ? {} : { activeBonusPhase: activeBonus }),
  };
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
