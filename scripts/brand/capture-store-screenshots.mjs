import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const extensionPath = resolve(root, '.output/chrome-mv3');
const screenshotDirectory = resolve(root, 'store-assets/screenshots');

async function expireActiveSessionDeadline(page) {
  await page.evaluate(async () => {
    const database = await new Promise((resolveDatabase, reject) => {
      const request = indexedDB.open('locusora');
      request.onsuccess = () => resolveDatabase(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Opening IndexedDB failed.'));
    });
    await new Promise((resolveTransaction, reject) => {
      const transaction = database.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();
      request.onsuccess = () => {
        const record = request.result.find(
          (candidate) => candidate.active === 1,
        );
        if (record === undefined) {
          reject(new Error('No active Session found.'));
          return;
        }
        const deadline =
          record.session.status === 'running'
            ? 'phaseEndsAt'
            : record.session.status === 'transitioning'
              ? 'transitionEndsAt'
              : null;
        if (deadline === null) {
          reject(
            new Error(
              `Session has no deadline in ${String(record.session.status)} state.`,
            ),
          );
          return;
        }
        record.session = { ...record.session, [deadline]: Date.now() - 1 };
        record.updatedAt = Date.now();
        store.put(record);
      };
      transaction.oncomplete = resolveTransaction;
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Updating Session failed.'));
    });
    database.close();
    await chrome.alarms.create('locusora.session-phase', {
      when: Date.now() + 1,
    });
  });
}

await mkdir(screenshotDirectory, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
  reducedMotion: 'reduce',
  locale: 'en-US',
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent('serviceworker');
  const extensionRoot = `chrome-extension://${new URL(worker.url()).host}`;
  const options = await context.newPage();
  await options.goto(`${extensionRoot}/options.html`);
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Deep writing ritual');
  await options.getByLabel('Phase 1 duration in minutes').fill('25');
  await options.getByLabel('Background color').fill('#dfeee6');
  await options.getByRole('button', { name: 'Add phase' }).click();
  await options.getByLabel('Phase 2 type').selectOption('break');
  await options.getByLabel('Phase 2 duration in minutes').fill('5');
  await options.getByLabel('Background color').nth(1).fill('#f6e7cf');
  await options.getByLabel('Enable Reward Dice').check();
  await options.getByLabel('Available rerolls').selectOption('1');
  await options.getByLabel('Reward side 1 icon').fill('☕');
  await options.getByLabel('Reward side 1 title').fill('Tea pause');
  await options
    .getByLabel('Reward side 1 description')
    .fill('Make a warm drink.');
  await options.getByLabel('Reward side 2 icon').fill('🌿');
  await options.getByLabel('Reward side 2 title').fill('Window reset');
  await options
    .getByLabel('Reward side 2 description')
    .fill('Look outside and breathe.');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options
    .getByRole('status')
    .filter({ hasText: 'Workflow saved' })
    .waitFor();
  await options.evaluate(() => window.scrollTo(0, 0));
  await options.screenshot({
    path: resolve(
      screenshotDirectory,
      'locusora-02-workflow-settings-1280x800.png',
    ),
    animations: 'disabled',
  });

  const focus = await context.newPage();
  await focus.goto(`${extensionRoot}/focus.html`);
  await focus
    .getByRole('button', { name: 'Start Deep writing ritual' })
    .click();
  await focus.getByRole('heading', { name: 'Deep writing ritual' }).waitFor();
  await focus.screenshot({
    path: resolve(screenshotDirectory, 'locusora-01-focus-light-1280x800.png'),
    animations: 'disabled',
  });

  await expireActiveSessionDeadline(focus);
  await focus
    .getByText('Transitioning to the next phase…')
    .waitFor({ timeout: 15_000 });
  await expireActiveSessionDeadline(focus);
  const reward = focus.getByRole('dialog', { name: 'Reward unlocked' });
  await reward.waitFor({ timeout: 15_000 });
  await focus.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await focus.getByRole('button', { name: 'Roll dice' }).click();
  await reward.getByRole('heading', { level: 3 }).waitFor({ timeout: 5_000 });
  await focus.screenshot({
    path: resolve(
      screenshotDirectory,
      'locusora-03-reward-ritual-dark-1280x800.png',
    ),
    animations: 'disabled',
  });
} finally {
  await context.close();
}

console.log(
  `Captured 3 Store screenshots in ${dirname(resolve(screenshotDirectory, 'x'))}.`,
);
