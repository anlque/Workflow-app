import type { Environment, EnvironmentInput } from './Environment';
import { WorkflowValidationError } from './WorkflowErrors';

declare const durationSecondsBrand: unique symbol;

export type DurationSeconds = number & {
  readonly [durationSecondsBrand]: 'DurationSeconds';
};

export type PhaseType = 'focus' | 'break';

export type Phase = Readonly<{
  type: PhaseType;
  durationSeconds: DurationSeconds;
  environment: Environment;
}>;

export type PhaseInput = Readonly<{
  type: string;
  durationSeconds: number;
  environment: EnvironmentInput;
}>;

export function createDurationSeconds(value: number): DurationSeconds {
  if (!Number.isInteger(value) || value <= 0) {
    throw new WorkflowValidationError(
      'Phase duration must be a positive integer number of seconds.',
    );
  }
  return value as DurationSeconds;
}
