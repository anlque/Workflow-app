import type { Environment, EnvironmentInput } from './Environment';

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
