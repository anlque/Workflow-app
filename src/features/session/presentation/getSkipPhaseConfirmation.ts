import { isRewardDueAfterPhase } from '@/features/workflow';

import type { Session } from '../domain/Session';

export type SkipPhaseConfirmation = Readonly<{
  title: string;
  body: string;
}>;

export function getSkipPhaseConfirmation(
  session: Session,
): SkipPhaseConfirmation | null {
  if (session.activeBonusPhase !== undefined) {
    return session.rewardRitual?.continuation.type === 'complete'
      ? {
          title: 'Skip Bonus Phase?',
          body: 'This will finish the session.',
        }
      : null;
  }

  const workflow = session.snapshot.workflow;
  const final = session.currentPhaseIndex === workflow.phases.length - 1;
  const rewardDue = isRewardDueAfterPhase(workflow, session.currentPhaseIndex);
  if (final) {
    return {
      title: 'Skip final phase?',
      body: rewardDue
        ? 'This will finish the session. Skipped phases do not unlock rewards.'
        : 'This will finish the session.',
    };
  }
  return rewardDue
    ? {
        title: 'Skip this phase?',
        body: 'Skipped phases do not unlock rewards. Your session will continue with the next phase.',
      }
    : null;
}
