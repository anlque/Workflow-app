import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow, WorkflowId } from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowRepository } from './WorkflowRepository';

export async function duplicateWorkflowUseCase(
  repository: WorkflowRepository,
  sourceId: WorkflowId,
  duplicateId: WorkflowId,
): Promise<Workflow> {
  const source = await repository.get(sourceId);
  if (source === null) {
    throw new WorkflowApplicationError(`Workflow ${sourceId} was not found.`);
  }

  if ((await repository.get(duplicateId)) !== null) {
    throw new WorkflowApplicationError(
      `Workflow ${duplicateId} already exists.`,
    );
  }

  const duplicate = createWorkflow({
    id: duplicateId,
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

  await repository.save(duplicate);
  return duplicate;
}
