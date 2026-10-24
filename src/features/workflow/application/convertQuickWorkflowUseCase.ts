import { createWorkflow } from '../domain/createWorkflow';
import type { CreateQuickWorkflowInput } from '../domain/QuickWorkflow';
import type {
  CreateDetailedWorkflowInput,
  Workflow,
  WorkflowId,
} from '../domain/Workflow';
import { WorkflowApplicationError } from './WorkflowApplicationError';
import type { WorkflowConversionUnitOfWork } from './WorkflowConversionUnitOfWork';
import type { WorkflowRepository } from './WorkflowRepository';

export type ConvertQuickWorkflowInput = Readonly<{
  sourceId: WorkflowId;
  input: CreateQuickWorkflowInput;
  copyId?: WorkflowId;
}>;

function detailedInput(
  workflow: Extract<Workflow, { mode: 'quick' }>,
): CreateDetailedWorkflowInput {
  return {
    mode: 'detailed',
    id: workflow.id,
    name: workflow.name,
    phases: workflow.phases,
    ...(workflow.rewardDice === undefined
      ? {}
      : {
          rewardDice: {
            schedule: workflow.rewardDice.schedule,
            rerolls: workflow.rewardDice.rerolls,
            sides: workflow.rewardDice.sides.map((side, index) => {
              const weight =
                workflow.configuration.rewardDice?.sides[index]?.weight;
              return {
                icon: side.icon,
                title: side.title,
                ...(side.description === undefined
                  ? {}
                  : { description: side.description }),
                ...(weight === undefined ? {} : { weight }),
                availability: side.availability,
                ...(side.bonusPhase === undefined
                  ? {}
                  : { bonusPhase: side.bonusPhase }),
              };
            }),
          },
        }),
  };
}

function copyName(source: string, workflows: readonly Workflow[]): string {
  const names = new Set(workflows.map(({ name }) => name.toLocaleLowerCase()));
  for (let suffix = 1; suffix <= workflows.length + 1; suffix += 1) {
    const label = suffix === 1 ? 'Quick copy' : `Quick copy ${String(suffix)}`;
    const candidate = `${source} (${label})`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new WorkflowApplicationError('A unique Quick copy name was not found.');
}

export async function convertQuickWorkflowUseCase(
  repository: WorkflowRepository,
  unitOfWork: WorkflowConversionUnitOfWork,
  input: ConvertQuickWorkflowInput,
) {
  const workflows = await repository.list();
  const source = workflows.find(({ id }) => id === input.sourceId);
  if (source === undefined)
    throw new WorkflowApplicationError(
      `Workflow ${input.sourceId} was not found.`,
    );
  if (source.mode !== 'quick')
    throw new WorkflowApplicationError(
      'Only a Quick Workflow can be converted.',
    );
  if (input.input.id !== source.id)
    throw new WorkflowApplicationError(
      'Conversion input must preserve the source Workflow identifier.',
    );
  if (
    input.copyId !== undefined &&
    workflows.some(({ id }) => id === input.copyId)
  )
    throw new WorkflowApplicationError('Quick copy identifier must be unique.');

  const current = createWorkflow(input.input);
  if (current.mode !== 'quick')
    throw new WorkflowApplicationError(
      'Only a Quick Workflow can be converted.',
    );
  const converted = createWorkflow(detailedInput(current));
  if (converted.mode !== 'detailed')
    throw new WorkflowApplicationError('Detailed conversion failed.');

  const quick = workflows.filter(
    (workflow) => workflow.mode === 'quick' && workflow.id !== source.id,
  );
  const detailed = workflows.filter((workflow) => workflow.mode === 'detailed');
  const sourceQuickIndex = workflows
    .filter((workflow) => workflow.mode === 'quick')
    .findIndex(({ id }) => id === source.id);
  const copy =
    input.copyId === undefined
      ? undefined
      : createWorkflow({
          ...input.input,
          id: input.copyId,
          name: copyName(current.name, workflows),
        });
  if (copy !== undefined && copy.mode !== 'quick')
    throw new WorkflowApplicationError('Quick copy creation failed.');
  if (copy !== undefined) quick.splice(sourceQuickIndex, 0, copy);
  const order = [
    ...quick.map(({ id }) => id),
    converted.id,
    ...detailed.map(({ id }) => id),
  ];
  await unitOfWork.commit({
    replacement: converted,
    ...(copy === undefined ? {} : { copy }),
    order,
  });
  return Object.freeze({
    converted,
    ...(copy === undefined ? {} : { copy }),
    order: Object.freeze(order),
  });
}
