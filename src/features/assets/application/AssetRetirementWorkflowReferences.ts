import type { Asset } from '../domain/Asset';
import type { AssetRetirementUsage } from './AssetRetirement';

export type AssetRetirementWorkflowReferences = Readonly<{
  summarize(source: Asset): Promise<readonly AssetRetirementUsage[]>;
  replace(source: Asset, replacement: Asset): Promise<void>;
  removeOptional(source: Asset): Promise<void>;
}>;
