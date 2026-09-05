export class ActiveSessionReferencedAssetError extends Error {
  public constructor() {
    super(
      'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
    );
    this.name = 'ActiveSessionReferencedAssetError';
  }
}
