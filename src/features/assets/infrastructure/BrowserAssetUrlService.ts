export class BrowserAssetUrlService {
  public create(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  public revoke(url: string): void {
    URL.revokeObjectURL(url);
  }
}
