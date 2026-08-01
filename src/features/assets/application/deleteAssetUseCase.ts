import type { AssetId } from '../domain/Asset';
import { ReferencedAssetError } from '../domain/AssetErrors';
import type { AssetRepository } from './AssetRepository';
import type { WorkflowAssetReferences } from './WorkflowAssetReferences';

export async function deleteAssetUseCase(
  repository: AssetRepository,
  references: WorkflowAssetReferences,
  id: AssetId,
): Promise<void> {
  const referenceCount = await references.count(id);
  if (!Number.isSafeInteger(referenceCount) || referenceCount < 0) {
    throw new Error('Workflow Asset reference count is invalid.');
  }
  if (referenceCount > 0) {
    throw new ReferencedAssetError(referenceCount);
  }
  await repository.delete(id);
}
