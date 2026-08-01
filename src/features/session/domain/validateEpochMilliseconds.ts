import { SessionValidationError } from './SessionErrors';

export function validateEpochMilliseconds(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new SessionValidationError(
      'Clock must return a finite non-negative epoch millisecond value.',
    );
  }
}
