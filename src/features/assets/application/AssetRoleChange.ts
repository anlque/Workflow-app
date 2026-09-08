import type { Asset, AssetKind, AssetRole } from '../domain/Asset';
import type { AssetId } from '../domain/Asset';
import type { AssetRoleRepository } from './AssetRoleRepository';

export type AssetRoleManagementRepository = AssetRoleRepository & {
  get(id: AssetId): Promise<Asset | null>;
  renameRole(targetId: AssetId, from: AssetRole, to: AssetRole): Promise<void>;
};

export type AssetRoleChangePreview = Readonly<{
  target: Asset;
  role: AssetRole;
  action: 'create' | 'rename' | 'move' | 'unchanged';
  currentOwner: Asset | null;
  affectedWorkflowCount: number;
  expectedKinds: readonly AssetKind[];
}>;
