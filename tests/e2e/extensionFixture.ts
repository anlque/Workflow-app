import { resolve } from 'node:path';

import { test as base, type BrowserContext, type Page } from '@playwright/test';

export type ExtensionUrls = Readonly<{
  options: string;
  sidePanel: string;
  focus: string;
}>;

type ExtensionFixtures = Readonly<{
  context: BrowserContext;
  extensionId: string;
  extensionUrls: ExtensionUrls;
}>;

const extensionPath = resolve(import.meta.dirname, '../../.output/chrome-mv3');

export async function expireActiveSessionDeadline(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('flowarium');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Opening IndexedDB failed.'));
      };
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();
      request.onsuccess = () => {
        const record = request.result.find(
          (candidate: { active?: unknown }) => candidate.active === 1,
        ) as
          | {
              session: Record<string, unknown>;
              updatedAt: number;
            }
          | undefined;
        if (record !== undefined) {
          const status = record.session['status'];
          const deadline =
            status === 'running'
              ? 'phaseEndsAt'
              : status === 'transitioning'
                ? 'transitionEndsAt'
                : null;
          if (deadline === null) {
            reject(
              new Error(
                `Active Session has no deadline in ${String(status)} state.`,
              ),
            );
            return;
          }
          record.session = {
            ...record.session,
            [deadline]: Date.now() - 1,
          };
          record.updatedAt = Date.now();
          store.put(record);
        }
      };
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('Updating Session failed.'));
      };
    });
    database.close();
    const extension = globalThis as typeof globalThis & {
      chrome: {
        alarms: {
          create(name: string, alarmInfo: { when: number }): Promise<void>;
        };
      };
    };
    await extension.chrome.alarms.create('flowarium.session-phase', {
      when: Date.now() + 1,
    });
  });
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({ playwright }, use) => {
    const context = await playwright.chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    worker ??= await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
  extensionUrls: async ({ extensionId }, use) => {
    const root = `chrome-extension://${extensionId}`;
    await use({
      options: `${root}/options.html`,
      sidePanel: `${root}/sidepanel.html`,
      focus: `${root}/focus.html`,
    });
  },
});

export { expect } from '@playwright/test';
