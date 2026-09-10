import type { ActiveSessionAssetReferences } from './ActiveSessionAssetReferences';
import { ActiveSessionReferencedAssetError } from './ActiveSessionReferencedAssetError';
import type {
  AssetRetirementChoice,
  AssetRetirementPreview,
  AssetRetirementRepository,
} from './AssetRetirement';
import {
  AssetRetirementValidationError,
  StaleAssetRetirementError,
} from './AssetRetirementErrors';
import type { AssetRetirementUnitOfWork } from './AssetRetirementUnitOfWork';
import type { AssetRetirementWorkflowReferences } from './AssetRetirementWorkflowReferences';
import {
  validateAssetImport,
  type AssetImportPolicy,
} from './importAssetUseCase';

function samePreview(
  left: AssetRetirementPreview,
  right: AssetRetirementPreview,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function inspect(
  repository: AssetRetirementRepository,
  active: ActiveSessionAssetReferences,
  workflows: AssetRetirementWorkflowReferences,
  id: AssetRetirementPreview['asset']['id'],
): Promise<AssetRetirementPreview> {
  if (await active.has(id)) throw new ActiveSessionReferencedAssetError();
  const asset = await repository.get(id);
  if (asset === null)
    throw new AssetRetirementValidationError('Asset was not found.');
  return { asset, usages: await workflows.summarize(asset) };
}

export const inspectAssetRetirementUseCase = inspect;

export async function retireAssetUseCase(
  repository: AssetRetirementRepository,
  active: ActiveSessionAssetReferences,
  workflows: AssetRetirementWorkflowReferences,
  unitOfWork: AssetRetirementUnitOfWork,
  policy: AssetImportPolicy,
  preview: AssetRetirementPreview,
  choice: AssetRetirementChoice,
): Promise<void> {
  await unitOfWork.run(async () => {
    const current = await inspect(
      repository,
      active,
      workflows,
      preview.asset.id,
    );
    if (!samePreview(current, preview)) throw new StaleAssetRetirementError();

    if (choice.type === 'remove') {
      if (
        current.usages.some(
          ({ requiredReferenceCount }) => requiredReferenceCount > 0,
        )
      ) {
        throw new AssetRetirementValidationError(
          'Required Workflow references cannot be removed. Choose a replacement Asset.',
        );
      }
      await workflows.removeOptional(current.asset);
      await repository.delete(current.asset.id);
      return;
    }

    const replacement =
      choice.type === 'existing'
        ? await repository.get(choice.assetId)
        : validateAssetImport(policy, choice.input);
    if (replacement === null) {
      throw new AssetRetirementValidationError(
        'Replacement Asset was not found.',
      );
    }
    if (replacement.id === current.asset.id) {
      throw new AssetRetirementValidationError(
        'Choose a different replacement Asset.',
      );
    }
    if (replacement.kind !== current.asset.kind) {
      throw new AssetRetirementValidationError(
        'Replacement Asset must have the same kind.',
      );
    }
    if (choice.type === 'upload')
      await repository.save(replacement, choice.input.blob);
    await workflows.replace(current.asset, replacement);
    if (current.asset.role !== undefined) {
      await repository.moveRole(replacement.id, current.asset.role);
    }
    await repository.delete(current.asset.id);
  });
}
