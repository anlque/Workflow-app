import type { Phase } from './Phase';

export function phaseDisplayName(phase: Phase, index: number): string {
  return phase.name ?? `Phase ${String(index + 1)}`;
}
