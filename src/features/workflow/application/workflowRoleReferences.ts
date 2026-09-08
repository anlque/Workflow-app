import {
  assetRoleKey,
  type AssetKind,
  type AssetRole,
} from '@/features/assets';

import type { AssetReference, EnvironmentInput } from '../domain/Environment';
import { createWorkflow } from '../domain/createWorkflow';
import type { Workflow } from '../domain/Workflow';
import type { WorkflowRepository } from './WorkflowRepository';

export type WorkflowRoleUsageSummary = Readonly<{
  workflowCount: number;
  expectedKinds: readonly AssetKind[];
}>;

function matches(
  reference: AssetReference | undefined,
  role: AssetRole,
): boolean {
  return (
    reference?.type === 'role' &&
    assetRoleKey(reference.role) === assetRoleKey(role)
  );
}

function usageKinds(
  workflow: Workflow,
  role: AssetRole,
): ReadonlySet<AssetKind> {
  const kinds = new Set<AssetKind>();
  workflow.phases.forEach(({ environment }) => {
    if (matches(environment.backgroundAsset, role)) kinds.add('image');
    if (matches(environment.audioAsset, role)) kinds.add('audio');
  });
  return kinds;
}

export async function summarizeWorkflowRoleReferences(
  repository: WorkflowRepository,
  role: AssetRole,
): Promise<WorkflowRoleUsageSummary> {
  let workflowCount = 0;
  const expectedKinds = new Set<AssetKind>();
  for (const workflow of await repository.list()) {
    const kinds = usageKinds(workflow, role);
    if (kinds.size > 0) workflowCount += 1;
    kinds.forEach((kind) => expectedKinds.add(kind));
  }
  return {
    workflowCount,
    expectedKinds: (['image', 'audio'] as const).filter((kind) =>
      expectedKinds.has(kind),
    ),
  };
}

function renameReference(
  reference: AssetReference | undefined,
  from: AssetRole,
  to: AssetRole,
): AssetReference | undefined {
  return matches(reference, from) ? { type: 'role', role: to } : reference;
}

function renameEnvironment(
  workflow: Workflow,
  phaseIndex: number,
  from: AssetRole,
  to: AssetRole,
): EnvironmentInput {
  const phase = workflow.phases[phaseIndex];
  if (phase === undefined) throw new Error('Workflow Phase was not found.');
  const environment = phase.environment;
  const backgroundAsset = renameReference(
    environment.backgroundAsset,
    from,
    to,
  );
  const audioAsset = renameReference(environment.audioAsset, from, to);
  return {
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(environment.backgroundColor === undefined
      ? {}
      : { backgroundColor: environment.backgroundColor }),
  };
}

export async function renameWorkflowRoleReferences(
  repository: WorkflowRepository,
  from: AssetRole,
  to: AssetRole,
): Promise<void> {
  for (const workflow of await repository.list()) {
    if (usageKinds(workflow, from).size === 0) continue;
    await repository.save(
      createWorkflow({
        id: workflow.id,
        name: workflow.name,
        phases: workflow.phases.map((phase, index) => ({
          type: phase.type,
          durationSeconds: phase.durationSeconds,
          environment: renameEnvironment(workflow, index, from, to),
        })),
        ...(workflow.rewardDice === undefined
          ? {}
          : {
              rewardDice: {
                triggerPhaseType: workflow.rewardDice.triggerPhaseType,
                frequency: workflow.rewardDice.frequency,
                rerolls: workflow.rewardDice.rerolls,
                sides: workflow.rewardDice.sides.map((side) => ({
                  icon: side.icon,
                  title: side.title,
                  ...(side.description === undefined
                    ? {}
                    : { description: side.description }),
                  weight: side.probability,
                })),
              },
            }),
      }),
    );
  }
}
