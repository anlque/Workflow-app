export class StarterContentValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'StarterContentValidationError';
  }
}

export class StarterContentConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'StarterContentConflictError';
  }
}
