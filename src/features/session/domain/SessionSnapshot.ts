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
    )
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
            triggerPhaseType: source.rewardDice.triggerPhaseType,
            frequency: source.rewardDice.frequency,
            rerolls: source.rewardDice.rerolls,
            sides: source.rewardDice.sides.map((side) => ({
              icon: side.icon,
              title: side.title,
              ...(side.description === undefined
                ? {}
                : { description: side.description }),
              weight: side.probability,
            })),
          },
        }),
  });

  return Object.freeze({ workflow });
}
