export type WorkflowPackageV1 = Readonly<{
  kind: 'locusora/workflow';
  version: 1;
  workflow: unknown;
  assets: readonly unknown[];
}>;

export type WorkflowPackageV2 = Readonly<{
  kind: 'locusora/workflow';
  version: 2;
  workflow: unknown;
  assets: readonly unknown[];
}>;

export type WorkflowPackageV3 = Readonly<{
  kind: 'locusora/workflow';
  version: 3;
  workflow: unknown;
  assets: readonly unknown[];
}>;

export type WorkflowPackageUnitOfWork = {
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
};

export class WorkflowPackageValidationError extends Error {
  public constructor(message = 'Workflow package is invalid.') {
    super(message);
    this.name = 'WorkflowPackageValidationError';
  }
}
