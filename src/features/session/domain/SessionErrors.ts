export class SessionValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SessionValidationError';
  }
}

export class SessionTransitionError extends Error {
  public constructor() {
    super('Session transition is not valid for its current state.');
    this.name = 'SessionTransitionError';
  }
}
