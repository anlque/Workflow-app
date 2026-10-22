import { createWorkflow } from '../domain/createWorkflow';
import type { EnvironmentInput } from '../domain/Environment';
import type { PhaseInput } from '../domain/Phase';
import type { RewardDiceInput } from '../domain/RewardDice';
import type { Workflow } from '../domain/Workflow';
import { WorkflowValidationError } from '../domain/WorkflowErrors';
import type { WorkflowRecord } from './WorkflowRecord';

type WorkflowSchemaVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  schemaVersion: WorkflowSchemaVersion,
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

function mapPhaseRecord(
  value: unknown,
  schemaVersion: WorkflowSchemaVersion,
): PhaseInput {
  const record = objectRecord(value);
  if (
    !hasExactKeys(
      record,
      ['type', 'durationSeconds', 'environment'],
      schemaVersion >= 6 ? ['name'] : [],
    )
  ) {
    return invalidRecord();
  }
  const name = optionalString(record['name']);
  return {
    ...(name === undefined ? {} : { name }),
    type: stringValue(record['type']),
    durationSeconds: numberValue(record['durationSeconds']),
    environment: mapEnvironmentRecord(record['environment'], schemaVersion),
  };
}

function mapRewardDiceRecord(
  value: unknown,
  schemaVersion: WorkflowSchemaVersion,
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
    if (schemaVersion < 3) {
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
      const availability =
        schemaVersion < 4 ? 'any' : stringValue(side['availability']);
      const required = ['icon', 'title', 'probability'];
      if (
        !hasExactKeys(
          side,
          schemaVersion < 4 ? required : [...required, 'availability'],
          schemaVersion >= 5 ? ['description', 'bonusPhase'] : ['description'],
        )
      ) {
        return invalidRecord();
      }
      const bonusPhase =
        side['bonusPhase'] === undefined
          ? undefined
          : mapBonusRewardPhaseRecord(side['bonusPhase'], schemaVersion);
      return {
        icon: stringValue(side['icon']),
        title: stringValue(side['title']),
        ...(description === undefined ? {} : { description }),
        weight: numberValue(side['probability']),
        availability: availability as 'any' | 'early' | 'late',
        ...(bonusPhase === undefined ? {} : { bonusPhase }),
      };
    }),
  };
}

function mapBonusRewardPhaseRecord(
  value: unknown,
  schemaVersion: WorkflowSchemaVersion,
) {
  if (schemaVersion < 5) return invalidRecord();
  const record = objectRecord(value);
  if (!hasExactKeys(record, ['name', 'durationSeconds', 'environment'])) {
    return invalidRecord();
  }
  return {
    name: stringValue(record['name']),
    durationSeconds: numberValue(record['durationSeconds']),
    environment: mapEnvironmentRecord(record['environment'], schemaVersion),
  };
}

export function mapWorkflowRecord(value: unknown): Workflow {
  const record = objectRecord(value);
  if (
    record['schemaVersion'] !== 1 &&
    record['schemaVersion'] !== 2 &&
    record['schemaVersion'] !== 3 &&
    record['schemaVersion'] !== 4 &&
    record['schemaVersion'] !== 5 &&
    record['schemaVersion'] !== 6 &&
    record['schemaVersion'] !== 7
  ) {
    return invalidRecord();
  }

  const order = numberValue(record['order']);
  if (!Number.isInteger(order) || order < 0) {
    return invalidRecord();
  }

  const schemaVersion = record['schemaVersion'];
  if (schemaVersion === 7 && record['mode'] === 'quick') {
    if (
      !hasExactKeys(record, [
        'schemaVersion',
        'mode',
        'id',
        'order',
        'name',
        'configuration',
      ])
    )
      return invalidRecord();
    return createWorkflow({
      mode: 'quick',
      id: stringValue(record['id']),
      name: stringValue(record['name']),
      configuration: mapQuickConfigurationRecord(record['configuration']),
    });
  }
  if (schemaVersion === 7 && record['mode'] !== 'detailed')
    return invalidRecord();
  if (
    schemaVersion === 7 &&
    !hasExactKeys(
      record,
      ['schemaVersion', 'mode', 'id', 'order', 'name', 'phases'],
      ['rewardDice'],
    )
  )
    return invalidRecord();
  const phases = record['phases'];
  if (!Array.isArray(phases)) {
    return invalidRecord();
  }

  const rewardDice =
    record['rewardDice'] === undefined
      ? undefined
      : mapRewardDiceRecord(record['rewardDice'], schemaVersion);

  return createWorkflow({
    mode: 'detailed',
    id: stringValue(record['id']),
    name: stringValue(record['name']),
    phases: phases.map((phase) => mapPhaseRecord(phase, schemaVersion)),
    ...(rewardDice === undefined ? {} : { rewardDice }),
  });
}

function mapQuickPhaseConfiguration(value: unknown, withFrequency: boolean) {
  const record = objectRecord(value);
  if (
    !hasExactKeys(
      record,
      withFrequency
        ? ['durationSeconds', 'environment', 'frequency']
        : ['durationSeconds', 'environment'],
    )
  )
    return invalidRecord();
  return {
    durationSeconds: numberValue(record['durationSeconds']),
    environment: mapEnvironmentRecord(record['environment'], 7),
    ...(withFrequency ? { frequency: numberValue(record['frequency']) } : {}),
  };
}

function mapQuickConfigurationRecord(value: unknown) {
  const record = objectRecord(value);
  if (
    !hasExactKeys(
      record,
      ['cycleCount', 'focus', 'shortBreak'],
      ['longBreak', 'rewardDice'],
    )
  )
    return invalidRecord();
  const reward =
    record['rewardDice'] === undefined
      ? undefined
      : objectRecord(record['rewardDice']);
  if (
    reward !== undefined &&
    (!hasExactKeys(reward, ['frequency', 'sides']) ||
      !Array.isArray(reward['sides']))
  )
    return invalidRecord();
  return {
    cycleCount: numberValue(record['cycleCount']),
    focus: mapQuickPhaseConfiguration(record['focus'], false),
    shortBreak: mapQuickPhaseConfiguration(record['shortBreak'], false),
    ...(record['longBreak'] === undefined
      ? {}
      : {
          longBreak: mapQuickPhaseConfiguration(record['longBreak'], true) as {
            durationSeconds: number;
            environment: EnvironmentInput;
            frequency: number;
          },
        }),
    ...(reward === undefined
      ? {}
      : {
          rewardDice: {
            frequency: numberValue(reward['frequency']),
            sides: (reward['sides'] as unknown[]).map((value) => {
              const side = objectRecord(value);
              if (!hasExactKeys(side, ['icon', 'title'], ['weight']))
                return invalidRecord();
              return {
                icon: stringValue(side['icon']),
                title: stringValue(side['title']),
                ...(side['weight'] === undefined
                  ? {}
                  : { weight: numberValue(side['weight']) }),
              };
            }),
          },
        }),
  };
}

function mapEnvironmentToRecord(
  environment: Workflow['phases'][number]['environment'],
) {
  return {
    ...(environment.backgroundAsset === undefined
      ? {}
      : { backgroundAsset: environment.backgroundAsset }),
    ...(environment.audioAsset === undefined
      ? {}
      : { audioAsset: environment.audioAsset }),
    ...(environment.backgroundColor === undefined
      ? {}
      : { backgroundColor: environment.backgroundColor }),
  };
}

export function mapWorkflowToRecord(
  workflow: Workflow,
  order: number,
): WorkflowRecord {
  if (workflow.mode === 'quick') {
    const mapPhase = (phase: typeof workflow.configuration.focus) => ({
      durationSeconds: phase.durationSeconds,
      environment: mapEnvironmentToRecord(phase.environment),
    });
    return {
      id: workflow.id,
      schemaVersion: 7,
      mode: 'quick',
      order,
      name: workflow.name,
      configuration: {
        cycleCount: workflow.configuration.cycleCount,
        focus: mapPhase(workflow.configuration.focus),
        shortBreak: mapPhase(workflow.configuration.shortBreak),
        ...(workflow.configuration.longBreak === undefined
          ? {}
          : {
              longBreak: {
                ...mapPhase(workflow.configuration.longBreak),
                frequency: workflow.configuration.longBreak.frequency,
              },
            }),
        ...(workflow.configuration.rewardDice === undefined
          ? {}
          : { rewardDice: workflow.configuration.rewardDice }),
      },
    };
  }
  return {
    id: workflow.id,
    schemaVersion: 7,
    mode: 'detailed',
    order,
    name: workflow.name,
    phases: workflow.phases.map((phase) => ({
      ...(phase.name === undefined ? {} : { name: phase.name }),
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
              availability: side.availability,
              ...(side.bonusPhase === undefined
                ? {}
                : {
                    bonusPhase: {
                      name: side.bonusPhase.name,
                      durationSeconds: side.bonusPhase.durationSeconds,
                      environment: {
                        ...(side.bonusPhase.environment.backgroundAsset ===
                        undefined
                          ? {}
                          : {
                              backgroundAsset:
                                side.bonusPhase.environment.backgroundAsset,
                            }),
                        ...(side.bonusPhase.environment.audioAsset === undefined
                          ? {}
                          : {
                              audioAsset:
                                side.bonusPhase.environment.audioAsset,
                            }),
                        ...(side.bonusPhase.environment.backgroundColor ===
                        undefined
                          ? {}
                          : {
                              backgroundColor:
                                side.bonusPhase.environment.backgroundColor,
                            }),
                      },
                    },
                  }),
            })),
          },
        }),
  };
}
