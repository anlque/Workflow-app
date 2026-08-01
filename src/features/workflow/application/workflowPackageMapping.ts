import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow } from '../domain/Workflow';
import { WorkflowPackageValidationError } from './WorkflowPackage';

function invalid(): never {
  throw new WorkflowPackageValidationError();
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

export function serializeWorkflow(workflow: Workflow): unknown {
  return {
    id: workflow.id,
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
            frequency: workflow.rewardDice.frequency,
            sides: workflow.rewardDice.sides.map((side) => ({
              icon: side.icon,
              title: side.title,
              ...(side.description === undefined
                ? {}
                : { description: side.description }),
              weight: side.probability,
            })),
          },
        }),
  };
}

export function parseWorkflow(value: unknown): Workflow {
  try {
    const input = record(value);
    if (!hasExactKeys(input, ['id', 'name', 'phases'], ['rewardDice'])) {
      return invalid();
    }
    const phaseValues = input['phases'];
    if (!Array.isArray(phaseValues)) return invalid();
    const rewardValue = input['rewardDice'];
    const reward = rewardValue === undefined ? undefined : record(rewardValue);
    const sideValues = reward?.['sides'];
    if (reward !== undefined && !Array.isArray(sideValues)) return invalid();
    if (reward !== undefined && !hasExactKeys(reward, ['frequency', 'sides'])) {
      return invalid();
    }

    return createWorkflow({
      id: string(input['id']),
      name: string(input['name']),
      phases: phaseValues.map((phaseValue) => {
        const phase = record(phaseValue);
        if (!hasExactKeys(phase, ['type', 'durationSeconds', 'environment'])) {
          return invalid();
        }
        const environment = record(phase['environment']);
        if (
          !hasExactKeys(
            environment,
            [],
            ['backgroundAssetId', 'audioAssetId', 'backgroundColor'],
          )
        ) {
          return invalid();
        }
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
              frequency: number(reward['frequency']),
              sides: (sideValues as unknown[]).map((sideValue) => {
                const side = record(sideValue);
                if (
                  !hasExactKeys(
                    side,
                    ['icon', 'title', 'weight'],
                    ['description'],
                  )
                ) {
                  return invalid();
                }
                const description = optionalString(side['description']);
                return {
                  icon: string(side['icon']),
                  title: string(side['title']),
                  ...(description === undefined ? {} : { description }),
                  weight: number(side['weight']),
                };
              }),
            },
          }),
    });
  } catch (error) {
    if (error instanceof WorkflowPackageValidationError) throw error;
    throw new WorkflowPackageValidationError();
  }
}
