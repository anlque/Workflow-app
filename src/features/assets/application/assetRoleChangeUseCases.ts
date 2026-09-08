import { assetRoleKey, createAssetRole, type AssetId } from '../domain/Asset';
import {
  AssetRoleMergeError,
  AssetValidationError,
  StaleAssetRoleChangeError,
} from '../domain/AssetErrors';
import type {
  AssetRoleChangePreview,
  AssetRoleManagementRepository,
} from './AssetRoleChange';
import type { AssetRoleManagementUnitOfWork } from './AssetRoleManagementUnitOfWork';
import type { AssetRoleWorkflowUsage } from './AssetRoleWorkflowUsage';

export async function inspectAssetRoleChangeUseCase(
  repository: AssetRoleManagementRepository,
  usage: AssetRoleWorkflowUsage,
  targetId: AssetId,
  value: string,
): Promise<AssetRoleChangePreview> {
  const role = createAssetRole(value);
  const target = await repository.get(targetId);
  if (target === null)
    throw new AssetValidationError('Target Asset was not found.');
  const owner = await repository.findByRole(role);
  if (owner !== null && owner.id !== target.id && target.role !== undefined) {
    throw new AssetRoleMergeError();
  }
  const action =
    owner?.id === target.id
      ? owner.role === role
        ? 'unchanged'
        : 'rename'
      : owner === null
        ? target.role === undefined
          ? 'create'
          : 'rename'
        : 'move';
  const summarizedRole =
    action === 'rename' ? target.role : action === 'move' ? role : undefined;
  const summary =
    summarizedRole === undefined
      ? { workflowCount: 0, expectedKinds: [] as const }
      : await usage.summarize(summarizedRole);
  return {
    target,
    role,
    action,
    currentOwner: owner,
    affectedWorkflowCount: summary.workflowCount,
    expectedKinds: summary.expectedKinds,
  };
}

function sameRole(
  left: string | undefined,
  right: string | undefined,
): boolean {
  return left === right;
}

export async function applyAssetRoleChangeUseCase(
  repository: AssetRoleManagementRepository,
  usage: AssetRoleWorkflowUsage,
  unitOfWork: AssetRoleManagementUnitOfWork,
  preview: AssetRoleChangePreview,
): Promise<void> {
  await unitOfWork.run(async () => {
    const target = await repository.get(preview.target.id);
    const owner = await repository.findByRole(preview.role);
    if (
      target === null ||
      !sameRole(target.role, preview.target.role) ||
      (owner?.id ?? null) !== (preview.currentOwner?.id ?? null)
    ) {
      throw new StaleAssetRoleChangeError();
    }
    if (preview.action === 'unchanged') return;
    if (preview.action === 'rename') {
      const from = target.role;
      if (
        from === undefined ||
        (assetRoleKey(from) === assetRoleKey(preview.role) &&
          from === preview.role)
      ) {
        throw new StaleAssetRoleChangeError();
      }
      await usage.renameReferences(from, preview.role);
      await repository.renameRole(target.id, from, preview.role);
      return;
    }
    await repository.moveRole(target.id, preview.role);
  });
}
