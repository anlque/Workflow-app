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

export class AssetRoleConflictError extends Error {
  public constructor() {
    super('Asset Role is already assigned to another Asset.');
    this.name = 'AssetRoleConflictError';
  }
}

export class AssetRoleMergeError extends Error {
  public constructor() {
    super(
      'This Asset already has a different Role. Choose another Asset or enter an available Role name.',
    );
    this.name = 'AssetRoleMergeError';
  }
}

export class StaleAssetRoleChangeError extends Error {
  public constructor() {
    super(
      'Asset Roles changed while this dialog was open. Review the change and try again.',
    );
    this.name = 'StaleAssetRoleChangeError';
  }
}
