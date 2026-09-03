import type { LocusoraDatabase } from '@/platform/storage';

import type { WorkflowPackageUnitOfWork } from '../application/WorkflowPackage';

export class DexieWorkflowPackageUnitOfWork implements WorkflowPackageUnitOfWork {
  readonly #database: LocusoraDatabase;

  public constructor(database: LocusoraDatabase) {
    this.#database = database;
  }

  public run<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.#database.runReadWriteMany(['workflows', 'assets'], operation);
  }
}
