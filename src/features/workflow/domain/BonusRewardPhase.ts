import {
  createEnvironment,
  type Environment,
  type EnvironmentInput,
} from './Environment';
import { createDurationSeconds, type DurationSeconds } from './Phase';
import { WorkflowValidationError } from './WorkflowErrors';

export type BonusRewardPhase = Readonly<{
  name: string;
  durationSeconds: DurationSeconds;
  environment: Environment;
}>;

export type BonusRewardPhaseInput = Readonly<{
  name: string;
  durationSeconds: number;
  environment: EnvironmentInput;
}>;

export function createBonusRewardPhase(
  input: BonusRewardPhaseInput,
): BonusRewardPhase {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new WorkflowValidationError(
      'Bonus Reward Phase name must not be empty.',
    );
  }
  return Object.freeze({
    name,
    durationSeconds: createDurationSeconds(input.durationSeconds),
    environment: createEnvironment(input.environment),
  });
}
