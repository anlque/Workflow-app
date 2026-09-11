import { createWorkflow } from '../domain/createWorkflow';
import type { EnvironmentInput } from '../domain/Environment';
import type { PhaseInput } from '../domain/Phase';
import type { RewardDiceInput } from '../domain/RewardDice';
import type { Workflow } from '../domain/Workflow';
import { WorkflowValidationError } from '../domain/WorkflowErrors';
import type { WorkflowRecord } from './WorkflowRecord';

function invalidRecord(): never {
  throw new WorkflowValidationError('Stored Workflow record is invalid.');
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidRecord();
  }

  return value as Readonly<Record<string, unknown>>;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : invalidRecord();
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : invalidRecord();
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : stringValue(value);
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

function rewardPhaseType(value: unknown): 'focus' | 'break' | undefined {
  if (value === undefined) return undefined;
  if (value === 'focus' || value === 'break') return value;
  return invalidRecord();
}

function mapAssetReference(value: unknown) {
  const reference = objectRecord(value);
  const keys = Object.keys(reference);
  if (
    reference['type'] === 'direct' &&
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('assetId')
  ) {
    return {
      type: 'direct' as const,
      assetId: stringValue(reference['assetId']),
    };
  }
  if (
    reference['type'] === 'role' &&
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('role')
  ) {
    return { type: 'role' as const, role: stringValue(reference['role']) };
  }
  return invalidRecord();
}

function mapEnvironmentRecord(
  value: unknown,
  schemaVersion: 1 | 2 | 3,
): EnvironmentInput {
  const record = objectRecord(value);
  const allowedKeys =
    schemaVersion === 1
      ? ['backgroundAssetId', 'audioAssetId', 'backgroundColor']
      : ['backgroundAsset', 'audioAsset', 'backgroundColor'];
  if (!hasOnlyKeys(record, allowedKeys)) return invalidRecord();
  const backgroundColor = optionalString(record['backgroundColor']);

  if (schemaVersion === 1) {
    const backgroundAssetId = optionalString(record['backgroundAssetId']);
    const audioAssetId = optionalString(record['audioAssetId']);
    return {
      ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
      ...(audioAssetId === undefined ? {} : { audioAssetId }),
      ...(backgroundColor === undefined ? {} : { backgroundColor }),
    };
  }

  const backgroundAsset =
    record['backgroundAsset'] === undefined
      ? undefined
      : mapAssetReference(record['backgroundAsset']);
  const audioAsset =
    record['audioAsset'] === undefined
      ? undefined
      : mapAssetReference(record['audioAsset']);

  return {
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
  };
}

function mapPhaseRecord(value: unknown, schemaVersion: 1 | 2 | 3): PhaseInput {
  const record = objectRecord(value);
  return {
    type: stringValue(record['type']),
    durationSeconds: numberValue(record['durationSeconds']),
    environment: mapEnvironmentRecord(record['environment'], schemaVersion),
  };
}

function mapRewardDiceRecord(
  value: unknown,
  schemaVersion: 1 | 2 | 3,
): RewardDiceInput {
  const record = objectRecord(value);
  const sides = record['sides'];
  const rerolls =
    record['rerolls'] === undefined
      ? undefined
      : numberValue(record['rerolls']);
  if (!Array.isArray(sides)) {
    return invalidRecord();
  }

  const schedule = (() => {
    if (schemaVersion !== 3) {
      if (
        !hasExactKeys(
          record,
          ['frequency', 'sides'],
          ['triggerPhaseType', 'rerolls'],
        )
      )
        return invalidRecord();
      const triggerPhaseType = rewardPhaseType(record['triggerPhaseType']);
      return {
        type: 'frequency' as const,
        triggerPhaseType: triggerPhaseType ?? 'focus',
        frequency: numberValue(record['frequency']),
      };
    }
    if (!hasExactKeys(record, ['schedule', 'sides'], ['rerolls']))
      return invalidRecord();
    const raw = objectRecord(record['schedule']);
    if (
      raw['type'] === 'frequency' &&
      hasExactKeys(raw, ['type', 'triggerPhaseType', 'frequency'])
    ) {
      const triggerPhaseType = rewardPhaseType(raw['triggerPhaseType']);
      if (triggerPhaseType === undefined) return invalidRecord();
      return {
        type: 'frequency' as const,
        triggerPhaseType,
        frequency: numberValue(raw['frequency']),
      };
    }
    if (
      raw['type'] === 'custom' &&
      hasExactKeys(raw, ['type', 'phaseIndexes']) &&
      Array.isArray(raw['phaseIndexes'])
    ) {
      return {
        type: 'custom' as const,
        phaseIndexes: raw['phaseIndexes'].map(numberValue),
      };
    }
    return invalidRecord();
  })();

  return {
    schedule,
    ...(rerolls === undefined ? {} : { rerolls }),
    sides: sides.map((sideValue) => {
      const side = objectRecord(sideValue);
      const description = optionalString(side['description']);
      return {
        icon: stringValue(side['icon']),
        title: stringValue(side['title']),
        ...(description === undefined ? {} : { description }),
        weight: numberValue(side['probability']),
      };
    }),
  };
}

export function mapWorkflowRecord(value: unknown): Workflow {
  const record = objectRecord(value);
  if (
    record['schemaVersion'] !== 1 &&
    record['schemaVersion'] !== 2 &&
    record['schemaVersion'] !== 3
  ) {
    return invalidRecord();
  }

  const order = numberValue(record['order']);
  if (!Number.isInteger(order) || order < 0) {
    return invalidRecord();
  }

  const phases = record['phases'];
  if (!Array.isArray(phases)) {
    return invalidRecord();
  }

  const schemaVersion = record['schemaVersion'];
  const rewardDice =
    record['rewardDice'] === undefined
      ? undefined
      : mapRewardDiceRecord(record['rewardDice'], schemaVersion);

  return createWorkflow({
    id: stringValue(record['id']),
    name: stringValue(record['name']),
    phases: phases.map((phase) => mapPhaseRecord(phase, schemaVersion)),
    ...(rewardDice === undefined ? {} : { rewardDice }),
  });
}

export function mapWorkflowToRecord(
  workflow: Workflow,
  order: number,
): WorkflowRecord {
  return {
    id: workflow.id,
    schemaVersion: 3,
    order,
    name: workflow.name,
    phases: workflow.phases.map((phase) => ({
      type: phase.type,
      durationSeconds: phase.durationSeconds,
      environment: {
        ...(phase.environment.backgroundAsset === undefined
          ? {}
          : { backgroundAsset: phase.environment.backgroundAsset }),
        ...(phase.environment.audioAsset === undefined
          ? {}
          : { audioAsset: phase.environment.audioAsset }),
        ...(phase.environment.backgroundColor === undefined
          ? {}
          : { backgroundColor: phase.environment.backgroundColor }),
      },
    })),
    ...(workflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: workflow.rewardDice.schedule,
            rerolls: workflow.rewardDice.rerolls,
            sides: workflow.rewardDice.sides.map((side) => ({
              icon: side.icon,
              title: side.title,
              ...(side.description === undefined
                ? {}
                : { description: side.description }),
              probability: side.probability,
            })),
          },
        }),
  };
}
