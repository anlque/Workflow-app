import type { AssetRoleManagementUnitOfWork } from '@/features/assets';
import type { LocusoraDatabase } from '@/platform/storage';

export class DexieAssetRoleManagementUnitOfWork implements AssetRoleManagementUnitOfWork {
  public constructor(private readonly database: LocusoraDatabase) {}

  public run<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.database.runReadWriteMany(['assets', 'workflows'], operation);
  }
}
