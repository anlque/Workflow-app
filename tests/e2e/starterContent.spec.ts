import type { BrowserContext, Page } from '@playwright/test';

import { expect, test } from './extensionFixture';

const starterAssetNames = [
  'Mosswood Canopy',
  'Rainlit Window',
  'Deep Tide',
  'Amber Library',
  'Starlit Ridge',
  'Cozy Bedroom Rain',
  'Lofi Chill',
  'Healing Bowl',
] as const;

async function readStarterCounts(page: Page): Promise<{
  assets: number;
  markers: number;
}> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('locusora');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Opening IndexedDB failed.'));
      };
    });
    const result = await new Promise<{ assets: number; markers: number }>(
      (resolve, reject) => {
        const transaction = database.transaction(
          ['assets', 'starterContentSeeds'],
          'readonly',
        );
        const assets = transaction.objectStore('assets').count();
        const markers = transaction.objectStore('starterContentSeeds').count();
        transaction.oncomplete = () => {
          resolve({ assets: assets.result, markers: markers.result });
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error('Reading IndexedDB failed.'));
        };
      },
    );
    database.close();
    return result;
  });
}

async function restartExtension(
  context: BrowserContext,
  extensionPage: Page,
): Promise<void> {
  const worker = context.serviceWorkers()[0];
  if (worker === undefined)
    throw new Error('Extension service worker missing.');
  const cdp = await context.newCDPSession(extensionPage);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const target = targetInfos.find(
    (candidate) =>
      candidate.type === 'service_worker' && candidate.url === worker.url(),
  );
  if (target === undefined) throw new Error('Service worker target missing.');
  await cdp.send('Target.closeTarget', { targetId: target.targetId });
  await extensionPage.evaluate(async () => {
    const extension = globalThis as typeof globalThis & {
      chrome: {
        runtime: {
          sendMessage(message: unknown): Promise<unknown>;
        };
      };
    };
    await extension.chrome.runtime.sendMessage({ type: 'session/get-active' });
  });
}

test('seeds starter Assets once and does not restore a retired Asset', async ({
  context,
  extensionUrls,
}) => {
  const networkRequests: string[] = [];
  context.on('request', (request) => {
    if (/^https?:/u.test(request.url())) networkRequests.push(request.url());
  });
  await context.setOffline(true);

  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();

  for (const name of starterAssetNames) {
    await expect(
      options.getByRole('listitem', {
        name: new RegExp(`^(Image|Audio): ${name}$`, 'u'),
      }),
    ).toHaveCount(1);
  }
  await expect
    .poll(() => readStarterCounts(options))
    .toEqual({
      assets: 8,
      markers: 1,
    });

  await options.getByRole('button', { name: 'Retire Mosswood Canopy' }).click();
  await options.getByRole('button', { name: 'Review usage' }).click();
  await options.getByRole('button', { name: 'Continue' }).click();
  await options
    .getByRole('radio', { name: 'Remove optional references' })
    .check();
  await options.getByRole('button', { name: 'Retire asset' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: Mosswood Canopy' }),
  ).toHaveCount(0);
  await expect
    .poll(() => readStarterCounts(options))
    .toEqual({
      assets: 7,
      markers: 1,
    });

  await restartExtension(context, options);
  const reopened = await context.newPage();
  await reopened.goto(extensionUrls.options);
  await reopened.getByRole('tab', { name: 'Assets' }).click();
  await expect(
    reopened.getByRole('listitem', { name: 'Image: Mosswood Canopy' }),
  ).toHaveCount(0);
  for (const name of starterAssetNames.slice(1)) {
    await expect(
      reopened.getByRole('listitem', {
        name: new RegExp(`^(Image|Audio): ${name}$`, 'u'),
      }),
    ).toHaveCount(1);
  }
  await expect
    .poll(() => readStarterCounts(reopened))
    .toEqual({
      assets: 7,
      markers: 1,
    });
  expect(networkRequests).toEqual([]);
});
