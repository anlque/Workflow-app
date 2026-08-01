export class WorkflowApplicationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowApplicationError';
  }
}
