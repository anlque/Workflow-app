export class AssetRetirementValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AssetRetirementValidationError';
  }
}

export class StaleAssetRetirementError extends Error {
  public constructor() {
    super(
      'Asset usage changed while this dialog was open. Review retirement and try again.',
    );
    this.name = 'StaleAssetRetirementError';
  }
}
