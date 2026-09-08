import type { AssetKind, AssetRole } from '../domain/Asset';

export type AssetRoleUsageSummary = Readonly<{
  workflowCount: number;
  expectedKinds: readonly AssetKind[];
}>;

export type AssetRoleWorkflowUsage = {
  summarize(role: AssetRole): Promise<AssetRoleUsageSummary>;
  renameReferences(from: AssetRole, to: AssetRole): Promise<void>;
};
