import { createWorkflow } from '../domain/createWorkflow';
import type { Environment, EnvironmentInput } from '../domain/Environment';
import type { Workflow } from '../domain/Workflow';

export type WorkflowEnvironmentLocation =
  | Readonly<{ owner: 'phase'; phaseIndex: number }>
  | Readonly<{ owner: 'bonus'; sideIndex: number }>
  | Readonly<{ owner: 'quick'; phase: 'focus' | 'short-break' | 'long-break' }>;

export type WorkflowEnvironmentEntry = Readonly<{
  environment: Environment;
  location: WorkflowEnvironmentLocation;
}>;

export function listWorkflowConfigurationEnvironments(
  workflow: Workflow,
): readonly WorkflowEnvironmentEntry[] {
  if (workflow.mode === 'quick') {
    return Object.freeze([
      {
        environment: workflow.configuration.focus.environment,
        location: { owner: 'quick', phase: 'focus' },
      },
      {
        environment: workflow.configuration.shortBreak.environment,
        location: { owner: 'quick', phase: 'short-break' },
      },
      ...(workflow.configuration.longBreak === undefined
        ? []
        : [
            {
              environment: workflow.configuration.longBreak.environment,
              location: {
                owner: 'quick' as const,
                phase: 'long-break' as const,
              },
            },
          ]),
    ]);
  }
  return Object.freeze([
    ...workflow.phases.map(({ environment }, phaseIndex) => ({
      environment,
      location: { owner: 'phase' as const, phaseIndex },
    })),
    ...(workflow.rewardDice?.sides.flatMap(({ bonusPhase }, sideIndex) =>
      bonusPhase === undefined
        ? []
        : [
            {
              environment: bonusPhase.environment,
              location: { owner: 'bonus' as const, sideIndex },
            },
          ],
    ) ?? []),
  ]);
}

export async function mapWorkflowConfigurationEnvironments(
  workflow: Workflow,
  transform: (
    environment: Environment,
    location: WorkflowEnvironmentLocation,
  ) => EnvironmentInput | Promise<EnvironmentInput>,
  identityOverride: Readonly<{ id?: string; name?: string }> = {},
): Promise<Workflow> {
  if (workflow.mode === 'quick') {
    const focus = await transform(workflow.configuration.focus.environment, {
      owner: 'quick',
      phase: 'focus',
    });
    const shortBreak = await transform(
      workflow.configuration.shortBreak.environment,
      { owner: 'quick', phase: 'short-break' },
    );
    const longBreak =
      workflow.configuration.longBreak === undefined
        ? undefined
        : {
            durationSeconds: workflow.configuration.longBreak.durationSeconds,
            frequency: workflow.configuration.longBreak.frequency,
            environment: await transform(
              workflow.configuration.longBreak.environment,
              { owner: 'quick', phase: 'long-break' },
            ),
          };
    return createWorkflow({
      mode: 'quick',
      id: identityOverride.id ?? workflow.id,
      name: identityOverride.name ?? workflow.name,
      configuration: {
        cycleCount: workflow.configuration.cycleCount,
        focus: {
          durationSeconds: workflow.configuration.focus.durationSeconds,
          environment: focus,
        },
        shortBreak: {
          durationSeconds: workflow.configuration.shortBreak.durationSeconds,
          environment: shortBreak,
        },
        ...(longBreak === undefined ? {} : { longBreak }),
        ...(workflow.configuration.rewardDice === undefined
          ? {}
          : { rewardDice: workflow.configuration.rewardDice }),
      },
    });
  }
  return createWorkflow({
    mode: 'detailed',
    id: identityOverride.id ?? workflow.id,
    name: identityOverride.name ?? workflow.name,
    phases: await Promise.all(
      workflow.phases.map(async (phase, phaseIndex) => ({
        ...(phase.name === undefined ? {} : { name: phase.name }),
        type: phase.type,
        durationSeconds: phase.durationSeconds,
        environment: await transform(phase.environment, {
          owner: 'phase',
          phaseIndex,
        }),
      })),
    ),
    ...(workflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: workflow.rewardDice.schedule,
            rerolls: workflow.rewardDice.rerolls,
            sides: await Promise.all(
              workflow.rewardDice.sides.map(async (side, sideIndex) => ({
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
                        environment: await transform(
                          side.bonusPhase.environment,
                          { owner: 'bonus', sideIndex },
                        ),
                      },
                    }),
              })),
            ),
          },
        }),
  });
}
