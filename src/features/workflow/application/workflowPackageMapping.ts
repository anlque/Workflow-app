import { createWorkflow } from '../domain/createWorkflow';
import type { Environment, EnvironmentInput } from '../domain/Environment';
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

function optionalRewardPhaseType(
  value: unknown,
): 'focus' | 'break' | undefined {
  if (value === undefined) return undefined;
  if (value === 'focus' || value === 'break') return value;
  return invalid();
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

function serializeEnvironment(environment: Environment): unknown {
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

function parseReference(value: unknown) {
  const reference = record(value);
  if (
    reference['type'] === 'direct' &&
    hasExactKeys(reference, ['type', 'assetId'])
  ) {
    return {
      type: 'direct' as const,
      assetId: string(reference['assetId']),
    };
  }
  if (
    reference['type'] === 'role' &&
    hasExactKeys(reference, ['type', 'role'])
  ) {
    return { type: 'role' as const, role: string(reference['role']) };
  }
  return invalid();
}

function parseEnvironment(
  value: unknown,
  version: 1 | 2 | 3 | 4 | 5,
): EnvironmentInput {
  const environment = record(value);
  const environmentKeys =
    version === 1
      ? ['backgroundAssetId', 'audioAssetId', 'backgroundColor']
      : ['backgroundAsset', 'audioAsset', 'backgroundColor'];
  if (!hasExactKeys(environment, [], environmentKeys)) return invalid();
  const backgroundAssetId = optionalString(environment['backgroundAssetId']);
  const audioAssetId = optionalString(environment['audioAssetId']);
  const backgroundAsset =
    environment['backgroundAsset'] === undefined
      ? undefined
      : parseReference(environment['backgroundAsset']);
  const audioAsset =
    environment['audioAsset'] === undefined
      ? undefined
      : parseReference(environment['audioAsset']);
  if (
    (backgroundAssetId !== undefined && backgroundAsset !== undefined) ||
    (audioAssetId !== undefined && audioAsset !== undefined)
  ) {
    return invalid();
  }
  const backgroundColor = optionalString(environment['backgroundColor']);
  return {
    ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
    ...(audioAssetId === undefined ? {} : { audioAssetId }),
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(backgroundColor === undefined ? {} : { backgroundColor }),
  };
}

export function serializeWorkflow(workflow: Workflow): unknown {
  return {
    id: workflow.id,
    name: workflow.name,
    phases: workflow.phases.map((phase) => ({
      type: phase.type,
      durationSeconds: phase.durationSeconds,
      environment: serializeEnvironment(phase.environment),
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
              weight: side.probability,
              availability: side.availability,
              ...(side.bonusPhase === undefined
                ? {}
                : {
                    bonusPhase: {
                      name: side.bonusPhase.name,
                      durationSeconds: side.bonusPhase.durationSeconds,
                      environment: serializeEnvironment(
                        side.bonusPhase.environment,
                      ),
                    },
                  }),
            })),
          },
        }),
  };
}

export function parseWorkflow(
  value: unknown,
  version: 1 | 2 | 3 | 4 | 5,
): Workflow {
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
    const rerolls =
      reward?.['rerolls'] === undefined ? undefined : number(reward['rerolls']);
    if (reward !== undefined && !Array.isArray(sideValues)) return invalid();
    const schedule = (() => {
      if (reward === undefined) return undefined;
      if (version < 3) {
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
      if (!hasExactKeys(reward, ['schedule', 'sides'], ['rerolls']))
        return invalid();
      const raw = record(reward['schedule']);
      if (
        raw['type'] === 'frequency' &&
        hasExactKeys(raw, ['type', 'triggerPhaseType', 'frequency'])
      ) {
        const triggerPhaseType = optionalRewardPhaseType(
          raw['triggerPhaseType'],
        );
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
      phases: phaseValues.map((phaseValue) => {
        const phase = record(phaseValue);
        if (!hasExactKeys(phase, ['type', 'durationSeconds', 'environment'])) {
          return invalid();
        }
        return {
          type: string(phase['type']),
          durationSeconds: number(phase['durationSeconds']),
          environment: parseEnvironment(phase['environment'], version),
        };
      }),
      ...(reward === undefined
        ? {}
        : {
            rewardDice: {
              schedule: schedule ?? invalid(),
              ...(rerolls === undefined ? {} : { rerolls }),
              sides: (sideValues as unknown[]).map((sideValue) => {
                const side = record(sideValue);
                const required = ['icon', 'title', 'weight'];
                if (
                  !hasExactKeys(
                    side,
                    version < 4 ? required : [...required, 'availability'],
                    version === 5
                      ? ['description', 'bonusPhase']
                      : ['description'],
                  )
                ) {
                  return invalid();
                }
                const description = optionalString(side['description']);
                const bonusPhase = (() => {
                  if (side['bonusPhase'] === undefined) return undefined;
                  if (version !== 5) return invalid();
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
                    environment: parseEnvironment(
                      bonus['environment'],
                      version,
                    ),
                  };
                })();
                return {
                  icon: string(side['icon']),
                  title: string(side['title']),
                  ...(description === undefined ? {} : { description }),
                  weight: number(side['weight']),
                  availability:
                    version < 4
                      ? 'any'
                      : (string(side['availability']) as
                          'any' | 'early' | 'late'),
                  ...(bonusPhase === undefined ? {} : { bonusPhase }),
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
