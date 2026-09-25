import { createWorkflow, type Workflow } from '@/features/workflow';

import { SessionValidationError } from './SessionErrors';

export type SessionSnapshot = Readonly<{
  workflow: Workflow;
}>;

export function createSessionSnapshot(source: Workflow): SessionSnapshot {
  if (
    source.phases.some(
      ({ environment }) =>
        environment.backgroundAsset?.type === 'role' ||
        environment.audioAsset?.type === 'role',
    ) ||
    (source.rewardDice?.sides.some(
      ({ bonusPhase }) =>
        bonusPhase?.environment.backgroundAsset?.type === 'role' ||
        bonusPhase?.environment.audioAsset?.type === 'role',
    ) ??
      false)
  ) {
    throw new SessionValidationError(
      'Session snapshot requires direct Asset references.',
    );
  }
  const workflow = createWorkflow({
    id: source.id,
    name: source.name,
    phases: source.phases,
    ...(source.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: source.rewardDice.schedule,
            rerolls: source.rewardDice.rerolls,
            sides: source.rewardDice.sides.map((side) => ({
              icon: side.icon,
              title: side.title,
              ...(side.description === undefined
                ? {}
                : { description: side.description }),
              availability: side.availability,
              weight: side.probability,
              ...(side.bonusPhase === undefined
                ? {}
                : {
                    bonusPhase: {
                      name: side.bonusPhase.name,
                      durationSeconds: side.bonusPhase.durationSeconds,
                      environment: side.bonusPhase.environment,
                    },
                  }),
            })),
          },
        }),
  });

  return Object.freeze({ workflow });
}
