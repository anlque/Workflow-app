export class WorkflowValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}
