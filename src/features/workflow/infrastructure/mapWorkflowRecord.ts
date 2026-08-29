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

function rewardPhaseType(value: unknown): 'focus' | 'break' | undefined {
  if (value === undefined) return undefined;
  if (value === 'focus' || value === 'break') return value;
  return invalidRecord();
}

function mapEnvironmentRecord(value: unknown): EnvironmentInput {
  const record = objectRecord(value);
  const backgroundAssetId = optionalString(record['backgroundAssetId']);
  const audioAssetId = optionalString(record['audioAssetId']);
  const backgroundColor = optionalString(record['backgroundColor']);

  return {
    ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
    ...(audioAssetId === undefined ? {} : { audioAssetId }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
  };
}

function mapPhaseRecord(value: unknown): PhaseInput {
  const record = objectRecord(value);
  return {
    type: stringValue(record['type']),
    durationSeconds: numberValue(record['durationSeconds']),
    environment: mapEnvironmentRecord(record['environment']),
  };
}

function mapRewardDiceRecord(value: unknown): RewardDiceInput {
  const record = objectRecord(value);
  const sides = record['sides'];
  const triggerPhaseType = rewardPhaseType(record['triggerPhaseType']);
  const rerolls =
    record['rerolls'] === undefined
      ? undefined
      : numberValue(record['rerolls']);
  if (!Array.isArray(sides)) {
    return invalidRecord();
  }

  return {
    ...(triggerPhaseType === undefined ? {} : { triggerPhaseType }),
    frequency: numberValue(record['frequency']),
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
  if (record['schemaVersion'] !== 1) {
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

  const rewardDice =
    record['rewardDice'] === undefined
      ? undefined
      : mapRewardDiceRecord(record['rewardDice']);

  return createWorkflow({
    id: stringValue(record['id']),
    name: stringValue(record['name']),
    phases: phases.map(mapPhaseRecord),
    ...(rewardDice === undefined ? {} : { rewardDice }),
  });
}

export function mapWorkflowToRecord(
  workflow: Workflow,
  order: number,
): WorkflowRecord {
  return {
    id: workflow.id,
    schemaVersion: 1,
    order,
    name: workflow.name,
    phases: workflow.phases.map((phase) => ({
      type: phase.type,
      durationSeconds: phase.durationSeconds,
      environment: {
        ...(phase.environment.backgroundAssetId === undefined
          ? {}
          : { backgroundAssetId: phase.environment.backgroundAssetId }),
        ...(phase.environment.audioAssetId === undefined
          ? {}
          : { audioAssetId: phase.environment.audioAssetId }),
        ...(phase.environment.backgroundColor === undefined
          ? {}
          : { backgroundColor: phase.environment.backgroundColor }),
      },
    })),
    ...(workflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            triggerPhaseType: workflow.rewardDice.triggerPhaseType,
            frequency: workflow.rewardDice.frequency,
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
