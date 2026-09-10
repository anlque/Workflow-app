import type { AssetRetirementUnitOfWork } from '@/features/assets';
import type { LocusoraDatabase } from '@/platform/storage';

export class DexieAssetRetirementUnitOfWork implements AssetRetirementUnitOfWork {
  public constructor(private readonly database: LocusoraDatabase) {}

  public run<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.database.runReadWriteMany(
      ['assets', 'workflows', 'sessions'],
      operation,
    );
  }
}
