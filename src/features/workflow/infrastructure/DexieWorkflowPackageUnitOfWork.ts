import type { FlowariumDatabase } from '@/platform/storage';

import type { WorkflowPackageUnitOfWork } from '../application/WorkflowPackage';

export class DexieWorkflowPackageUnitOfWork implements WorkflowPackageUnitOfWork {
  readonly #database: FlowariumDatabase;

  public constructor(database: FlowariumDatabase) {
    this.#database = database;
  }

  public run<Result>(operation: () => Promise<Result>): Promise<Result> {
    return this.#database.runReadWriteMany(['workflows', 'assets'], operation);
  }
}
