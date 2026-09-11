import type { DiceSide, DiceSideInput } from './DiceSide';
import { createAssetRole } from '@/features/assets';

import type {
  AssetId,
  AssetReference,
  AssetReferenceInput,
  Environment,
  EnvironmentInput,
} from './Environment';
import type { DurationSeconds, Phase, PhaseInput, PhaseType } from './Phase';
import type {
  RewardDice,
  RewardDiceInput,
  RewardPhaseType,
  RewardSchedule,
} from './RewardDice';
import {
  createWorkflowId,
  type CreateWorkflowInput,
  type Workflow,
} from './Workflow';
import { WorkflowValidationError } from './WorkflowErrors';

function createAssetId(value: string): AssetId {
  if (value.trim().length === 0) {
    throw new WorkflowValidationError('Asset identifier must not be empty.');
  }

  return value as AssetId;
}

function createDurationSeconds(value: number): DurationSeconds {
  if (!Number.isInteger(value) || value <= 0) {
    throw new WorkflowValidationError(
      'Phase duration must be a positive integer number of seconds.',
    );
  }

  return value as DurationSeconds;
}

function createPhaseType(value: string): PhaseType {
  if (value !== 'focus' && value !== 'break') {
    throw new WorkflowValidationError('Phase type must be focus or break.');
  }

  return value;
}

function createEnvironment(input: EnvironmentInput): Environment {
  const createAssetReference = (value: AssetReferenceInput): AssetReference => {
    const candidate: Readonly<{
      type?: unknown;
      assetId?: unknown;
      role?: unknown;
    }> = value;
    const keys = Object.keys(value);
    if (
      candidate.type === 'direct' &&
      typeof candidate.assetId === 'string' &&
      keys.length === 2 &&
      keys.includes('type') &&
      keys.includes('assetId')
    ) {
      return Object.freeze({
        type: 'direct',
        assetId: createAssetId(candidate.assetId),
      });
    }
    if (
      candidate.type === 'role' &&
      typeof candidate.role === 'string' &&
      keys.length === 2 &&
      keys.includes('type') &&
      keys.includes('role')
    ) {
      return Object.freeze({
        type: 'role',
        role: createAssetRole(candidate.role),
      });
    }
    throw new WorkflowValidationError(
      'Asset reference must be direct or role-based.',
    );
  };
  if (
    (input.backgroundAsset !== undefined &&
      input.backgroundAssetId !== undefined) ||
    (input.audioAsset !== undefined && input.audioAssetId !== undefined)
  ) {
    throw new WorkflowValidationError(
      'Environment Asset reference is ambiguous.',
    );
  }
  const backgroundInput =
    input.backgroundAsset ??
    (input.backgroundAssetId === undefined
      ? undefined
      : { type: 'direct' as const, assetId: input.backgroundAssetId });
  const audioInput =
    input.audioAsset ??
    (input.audioAssetId === undefined
      ? undefined
      : { type: 'direct' as const, assetId: input.audioAssetId });
  const backgroundAsset =
    backgroundInput === undefined
      ? undefined
      : createAssetReference(backgroundInput);
  const audioAsset =
    audioInput === undefined ? undefined : createAssetReference(audioInput);

  if (input.backgroundColor?.trim().length === 0) {
    throw new WorkflowValidationError(
      'Environment background color must not be empty.',
    );
  }

  return Object.freeze({
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(input.backgroundColor === undefined
      ? {}
      : { backgroundColor: input.backgroundColor }),
  });
}

function createPhase(input: PhaseInput): Phase {
  return Object.freeze({
    type: createPhaseType(input.type),
    durationSeconds: createDurationSeconds(input.durationSeconds),
    environment: createEnvironment(input.environment),
  });
}

function validateDiceSide(input: DiceSideInput): void {
  if (input.icon.trim().length === 0) {
    throw new WorkflowValidationError('Dice Side icon must not be empty.');
  }

  if (input.title.trim().length === 0) {
    throw new WorkflowValidationError('Dice Side title must not be empty.');
  }
}

function createRewardPhaseType(value: unknown): RewardPhaseType {
  if (value === undefined || value === 'focus') return 'focus';
  if (value === 'break') return 'break';
  throw new WorkflowValidationError(
    'Reward Dice trigger Phase type must be focus or break.',
  );
}

function createCanonicalRewardPhaseType(value: unknown): RewardPhaseType {
  if (value === 'focus' || value === 'break') return value;
  throw new WorkflowValidationError(
    'Reward Dice trigger Phase type must be focus or break.',
  );
}

function hasExactOwnKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function createRewardSchedule(
  input: RewardDiceInput,
  phaseCount: number,
): RewardSchedule {
  if (Object.hasOwn(input, 'schedule')) {
    const rawInput = input as unknown as Readonly<Record<string, unknown>>;
    const rawSchedule = rawInput['schedule'];
    if (
      typeof rawSchedule !== 'object' ||
      rawSchedule === null ||
      Array.isArray(rawSchedule)
    ) {
      throw new WorkflowValidationError(
        'Reward Dice schedule must be frequency or custom.',
      );
    }
    const schedule = rawSchedule as Readonly<Record<string, unknown>>;
    if (schedule['type'] !== 'custom' && schedule['type'] !== 'frequency') {
      throw new WorkflowValidationError(
        'Reward Dice schedule must be frequency or custom.',
      );
    }
    if (
      Object.hasOwn(rawInput, 'triggerPhaseType') ||
      Object.hasOwn(rawInput, 'frequency')
    ) {
      throw new WorkflowValidationError(
        'Reward Dice schedule cannot be combined with legacy timing fields.',
      );
    }
    if (schedule['type'] === 'custom') {
      const rawPhaseIndexes = schedule['phaseIndexes'];
      if (!Array.isArray(rawPhaseIndexes)) {
        throw new WorkflowValidationError(
          'Custom Reward phase indexes must be unique in-range integers.',
        );
      }
      const phaseIndexes = [...(rawPhaseIndexes as number[])];
      if (
        phaseIndexes.some(
          (index) =>
            !Number.isInteger(index) || index < 0 || index >= phaseCount,
        ) ||
        new Set(phaseIndexes).size !== phaseIndexes.length
      ) {
        throw new WorkflowValidationError(
          'Custom Reward phase indexes must be unique in-range integers.',
        );
      }
      if (!hasExactOwnKeys(schedule, ['type', 'phaseIndexes'])) {
        throw new WorkflowValidationError(
          'Reward Dice schedule must use canonical fields.',
        );
      }
      return Object.freeze({
        type: 'custom',
        phaseIndexes: Object.freeze(
          phaseIndexes.sort((left, right) => left - right),
        ),
      });
    }
    const triggerPhaseType = createCanonicalRewardPhaseType(
      schedule['triggerPhaseType'],
    );
    const frequency = schedule['frequency'];
    if (
      typeof frequency !== 'number' ||
      !Number.isInteger(frequency) ||
      frequency < 1
    ) {
      throw new WorkflowValidationError(
        'Reward Dice frequency must be a positive integer.',
      );
    }
    if (!hasExactOwnKeys(schedule, ['type', 'triggerPhaseType', 'frequency'])) {
      throw new WorkflowValidationError(
        'Reward Dice schedule must use canonical fields.',
      );
    }
    return Object.freeze({ type: 'frequency', triggerPhaseType, frequency });
  }
  const triggerPhaseType = createRewardPhaseType(input.triggerPhaseType);
  const frequency = input.frequency;
  if (
    typeof frequency !== 'number' ||
    !Number.isInteger(frequency) ||
    frequency < 1
  ) {
    throw new WorkflowValidationError(
      'Reward Dice frequency must be a positive integer.',
    );
  }
  return Object.freeze({ type: 'frequency', triggerPhaseType, frequency });
}

function createRewardDice(
  input: RewardDiceInput,
  phaseCount: number,
): RewardDice {
  const schedule = createRewardSchedule(input, phaseCount);
  const rerolls = input.rerolls ?? 0;
  if (!Number.isInteger(rerolls) || rerolls < 0 || rerolls > 3) {
    throw new WorkflowValidationError(
      'Reward Dice rerolls must be an integer from 0 through 3.',
    );
  }

  const [firstInput, secondInput, ...remainingInputs] = input.sides;
  if (firstInput === undefined || secondInput === undefined) {
    throw new WorkflowValidationError(
      'Reward Dice must contain at least two sides.',
    );
  }

  input.sides.forEach(validateDiceSide);

  const customWeightCount = input.sides.filter(
    ({ weight }) => weight !== undefined,
  ).length;
  if (customWeightCount !== 0 && customWeightCount !== input.sides.length) {
    throw new WorkflowValidationError(
      'Reward Dice weights must be provided for every side or omitted for every side.',
    );
  }

  const weights = input.sides.map(({ weight }) => weight ?? 1);
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new WorkflowValidationError(
      'Reward Dice weights must be finite positive numbers.',
    );
  }

  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (!Number.isFinite(totalWeight)) {
    throw new WorkflowValidationError(
      'Reward Dice weights must have a finite total.',
    );
  }

  const createSide = (sideInput: DiceSideInput): DiceSide =>
    Object.freeze({
      icon: sideInput.icon.trim(),
      title: sideInput.title.trim(),
      ...(sideInput.description === undefined
        ? {}
        : { description: sideInput.description.trim() }),
      probability: (sideInput.weight ?? 1) / totalWeight,
    });

  const firstSide = createSide(firstInput);
  const secondSide = createSide(secondInput);
  const remainingSides = remainingInputs.map(createSide);
  const sides: readonly [DiceSide, DiceSide, ...DiceSide[]] = [
    firstSide,
    secondSide,
    ...remainingSides,
  ];

  return Object.freeze({
    schedule,
    rerolls,
    sides: Object.freeze(sides),
  });
}

export function createWorkflow(input: CreateWorkflowInput): Workflow {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new WorkflowValidationError('Workflow name must not be empty.');
  }

  const [firstPhaseInput, ...remainingPhaseInputs] = input.phases;
  if (firstPhaseInput === undefined) {
    throw new WorkflowValidationError(
      'Workflow must contain at least one Phase.',
    );
  }

  const firstPhase = createPhase(firstPhaseInput);
  const remainingPhases = remainingPhaseInputs.map(createPhase);
  const phases: readonly [Phase, ...Phase[]] = [firstPhase, ...remainingPhases];
  const rewardDice =
    input.rewardDice === undefined
      ? undefined
      : createRewardDice(input.rewardDice, phases.length);

  return Object.freeze({
    id: createWorkflowId(input.id),
    name,
    phases: Object.freeze(phases),
    ...(rewardDice === undefined ? {} : { rewardDice }),
  });
}
