import type { Asset, AssetId } from '../domain/Asset';
import type { AssetRepository } from './AssetRepository';
import type { AssetRoleManagementRepository } from './AssetRoleChange';
import type { ImportAssetInput } from './importAssetUseCase';

export type AssetRetirementRepository = AssetRepository &
  AssetRoleManagementRepository;

export type AssetRetirementUsage = Readonly<{
  workflowId: string;
  workflowName: string;
  occurrences: readonly AssetRetirementOccurrence[];
}>;

export type AssetRetirementOccurrence = Readonly<{
  phaseIndex: number;
  location: 'background' | 'audio';
  referenceMode: 'direct' | 'role';
  optional: boolean;
}>;

export type AssetRetirementPreview = Readonly<{
  asset: Asset;
  usages: readonly AssetRetirementUsage[];
}>;

export type AssetRetirementChoice =
  | Readonly<{ type: 'existing'; assetId: AssetId }>
  | Readonly<{ type: 'upload'; input: ImportAssetInput }>
  | Readonly<{ type: 'remove' }>;
