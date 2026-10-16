import { browser } from 'wxt/browser';

type ExtensionRuntime = Readonly<{
  getURL(path: string): string;
}>;

type RequestFile = (url: string) => Promise<Response>;

export async function loadPackagedSeedFile(
  path: string,
  runtime: ExtensionRuntime = browser.runtime,
  request: RequestFile = fetch,
): Promise<Blob> {
  const response = await request(runtime.getURL(path.replace(/^\//u, '')));
  if (!response.ok) {
    throw new Error(
      `Unable to load packaged starter content ${path}: HTTP ${String(response.status)}.`,
    );
  }
  return response.blob();
}
