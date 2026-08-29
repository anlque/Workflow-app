import type { DiceSide, DiceSideInput } from './DiceSide';
import type { AssetId, Environment, EnvironmentInput } from './Environment';
import type { DurationSeconds, Phase, PhaseInput, PhaseType } from './Phase';
import type {
  RewardDice,
  RewardDiceInput,
  RewardPhaseType,
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
  const backgroundAssetId =
    input.backgroundAssetId === undefined
      ? undefined
      : createAssetId(input.backgroundAssetId);
  const audioAssetId =
    input.audioAssetId === undefined
      ? undefined
      : createAssetId(input.audioAssetId);

  if (input.backgroundColor?.trim().length === 0) {
    throw new WorkflowValidationError(
      'Environment background color must not be empty.',
    );
  }

  return Object.freeze({
    ...(backgroundAssetId === undefined ? {} : { backgroundAssetId }),
    ...(audioAssetId === undefined ? {} : { audioAssetId }),
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

function createRewardDice(input: RewardDiceInput): RewardDice {
  const triggerPhaseType = createRewardPhaseType(input.triggerPhaseType);
  const rerolls = input.rerolls ?? 0;
  if (!Number.isInteger(input.frequency) || input.frequency < 1) {
    throw new WorkflowValidationError(
      'Reward Dice frequency must be a positive integer.',
    );
  }
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
    triggerPhaseType,
    frequency: input.frequency,
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
      : createRewardDice(input.rewardDice);

  return Object.freeze({
    id: createWorkflowId(input.id),
    name,
    phases: Object.freeze(phases),
    ...(rewardDice === undefined ? {} : { rewardDice }),
  });
}
