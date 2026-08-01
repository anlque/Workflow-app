import { resolve } from 'node:path';

import { test as base, type BrowserContext } from '@playwright/test';

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
