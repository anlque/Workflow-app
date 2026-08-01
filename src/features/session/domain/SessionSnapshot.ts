import { createWorkflow, type Workflow } from '@/features/workflow';

export type SessionSnapshot = Readonly<{
  workflow: Workflow;
}>;

export function createSessionSnapshot(source: Workflow): SessionSnapshot {
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
