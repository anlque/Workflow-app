export type WorkflowPackageV1 = Readonly<{
  kind: 'flowarium/workflow';
  version: 1;
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
