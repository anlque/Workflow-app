export class SessionApplicationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SessionApplicationError';
  }
}
