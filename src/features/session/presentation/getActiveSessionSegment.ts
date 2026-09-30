import { phaseDisplayName, type Environment } from '@/features/workflow';

import type { Session } from '../domain/Session';

export type ActiveSessionSegment = Readonly<{
  isBonus: boolean;
  label: string;
  environment: Environment;
}>;

export function getActiveSessionSegment(
  session: Session,
): ActiveSessionSegment {
  const workflow = session.snapshot.workflow;
  const active = session.activeBonusPhase;
  if (active !== undefined) {
    const bonus =
      workflow.rewardDice?.sides[active.selectedSideIndex]?.bonusPhase;
    if (bonus !== undefined) {
      return Object.freeze({
        isBonus: true,
        label: bonus.name,
        environment: bonus.environment,
      });
    }
  }
  const phase =
    workflow.phases[session.currentPhaseIndex] ?? workflow.phases[0];
  return Object.freeze({
    isBonus: false,
    label:
      phase.name === undefined
        ? `${phase.type === 'focus' ? 'Focus' : 'Break'} · ${phaseDisplayName(phase, session.currentPhaseIndex)} of ${String(workflow.phases.length)}`
        : `${phase.type === 'focus' ? 'Focus' : 'Break'} · ${phaseDisplayName(phase, session.currentPhaseIndex)} · Phase ${String(session.currentPhaseIndex + 1)} of ${String(workflow.phases.length)}`,
    environment: phase.environment,
  });
}
