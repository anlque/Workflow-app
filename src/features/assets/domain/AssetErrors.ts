export class AssetValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

export class ReferencedAssetError extends Error {
  public constructor(referenceCount: number) {
    super(
      `Asset is referenced by ${String(referenceCount)} ${referenceCount === 1 ? 'Workflow' : 'Workflows'}.`,
    );
    this.name = 'ReferencedAssetError';
  }
}

export class AssetStorageError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AssetStorageError';
  }
}
