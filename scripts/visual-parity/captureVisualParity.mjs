import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

import {
  actualCaptureDirectory,
  validateVisualParityManifest,
  visualParityManifest,
} from './visualParityManifest.mjs';

const manifestCaptures = visualParityManifest
  .filter(({ actualFilename }) => actualFilename !== undefined)
  .map((entry) => ({
    id: entry.id,
    actualFilename: entry.actualFilename,
    comparisonMode: entry.comparisonMode,
    viewport:
      entry.viewport ??
      (entry.id === 'quick-setup-composite'
        ? { width: 1601, height: 1200 }
        : { width: 1512, height: 987 }),
  }));

export const captureDefinitions = Object.freeze([
  ...manifestCaptures,
  {
    id: 'focus-paused',
    actualFilename: 'focus-paused.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 1512, height: 987 },
  },
  {
    id: 'focus-transition',
    actualFilename: 'focus-transition.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 1512, height: 987 },
  },
  {
    id: 'focus-stop-confirmation',
    actualFilename: 'focus-stop-confirmation.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 1512, height: 987 },
  },
  {
    id: 'focus-empty',
    actualFilename: 'focus-empty.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 1512, height: 987 },
  },
  {
    id: 'focus-initialization-error',
    actualFilename: 'focus-initialization-error.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 1512, height: 987 },
  },
  {
    id: 'focus-narrow',
    actualFilename: 'focus-narrow.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 640, height: 900 },
  },
  {
    id: 'focus-200-percent',
    actualFilename: 'focus-200-percent.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 756, height: 493 },
  },
  {
    id: 'side-panel-workflows',
    actualFilename: 'side-panel-workflows.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 420, height: 900 },
  },
  {
    id: 'side-panel-workflows-wide',
    actualFilename: 'side-panel-workflows-wide.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 640, height: 900 },
  },
  {
    id: 'side-panel-workflows-narrow',
    actualFilename: 'side-panel-workflows-narrow.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 320, height: 900 },
  },
  {
    id: 'side-panel-workflows-200-percent',
    actualFilename: 'side-panel-workflows-200-percent.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 210, height: 450 },
  },
  {
    id: 'side-panel-session',
    actualFilename: 'side-panel-session.png',
    comparisonMode: 'consistency-only',
    viewport: { width: 420, height: 900 },
  },
]);

const repositoryRoot = resolve(import.meta.dirname, '../..');
const extensionPath = resolve(repositoryRoot, '.output/chrome-mv3');

function definition(id) {
  const value = captureDefinitions.find((candidate) => candidate.id === id);
  if (value === undefined) throw new Error(`Unknown capture ID: ${id}`);
  return value;
}

async function waitForStableDocument(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function capture(page, id) {
  const item = definition(id);
  await page.setViewportSize(item.viewport);
  await waitForStableDocument(page);
  await page.screenshot({
    path: resolve(actualCaptureDirectory, item.actualFilename),
    animations: 'disabled',
  });
  console.log(`Captured ${id} → ${item.actualFilename}`);
}

async function openWorkflowLibrary(page) {
  const back = page.getByRole('button', { name: 'Back to workflows' });
  const create = page
    .getByRole('button', { name: 'New workflow' })
    .or(page.getByRole('button', { name: 'Create workflow' }));
  try {
    await back.or(create).waitFor();
  } catch (cause) {
    console.error(
      `Options diagnostic:\n${await page.locator('body').innerText()}`,
    );
    await page.screenshot({
      path: resolve(actualCaptureDirectory, 'diagnostic-options.png'),
      animations: 'disabled',
    });
    throw cause;
  }
  if (await back.isVisible()) await back.click();
  await create.waitFor();
}

async function openNewWorkflow(page, mode) {
  await openWorkflowLibrary(page);
  await page
    .getByRole('button', { name: 'New workflow' })
    .or(page.getByRole('button', { name: 'Create workflow' }))
    .click();
  await page.getByRole('button', { name: mode }).click();
}

async function seedVisualAssets(options) {
  await options.getByRole('tab', { name: 'Assets' }).click();
  const addAsset = options.getByLabel('Add local image or audio');
  await addAsset.setInputFiles({
    name: 'visual-parity-image.webp',
    mimeType: 'image/webp',
    buffer: await readFile(
      resolve(repositoryRoot, 'public/seed/backgrounds/mosswood-canopy.webp'),
    ),
  });
  await options
    .getByRole('listitem', { name: 'Image: visual-parity-image.webp' })
    .waitFor();
  await addAsset.setInputFiles({
    name: 'visual-parity-audio.ogg',
    mimeType: 'audio/ogg',
    buffer: await readFile(
      resolve(repositoryRoot, 'public/seed/audio/lofi-chill.ogg'),
    ),
  });
  await options
    .getByRole('listitem', { name: 'Audio: visual-parity-audio.ogg' })
    .waitFor();
  await options.getByRole('tab', { name: 'Workflows' }).click();
}

async function createDetailedImageWorkflow(options) {
  await openNewWorkflow(options, 'Detailed setup');
  await options.getByLabel('Workflow name').fill('Visual parity image flow');
  await options.getByLabel('Phase 1 name').fill('Writing');
  await options.getByLabel('Phase 1 duration in minutes').fill('25');
  await options.getByLabel('Background image').selectOption({
    label: 'visual-parity-image.webp',
  });
  await options.getByLabel('Ambient audio').selectOption({
    label: 'visual-parity-audio.ogg',
  });
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options
    .getByRole('status')
    .filter({ hasText: 'Workflow saved' })
    .waitFor();
}

async function createDetailedVisualWorkflow(options) {
  await openNewWorkflow(options, 'Detailed setup');
  await options.getByLabel('Workflow name').fill('Visual parity color flow');
  await options.getByLabel('Phase 1 name').fill('Writing');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByLabel('Background color').fill('#b50000');
  await options.getByRole('button', { name: 'Add phase' }).click();
  await options.getByRole('button', { name: 'Select Phase 2' }).click();
  await options.getByLabel('Phase 2 name').fill('Important Break');
  await options.getByLabel('Phase 2 type').selectOption('break');
  await options.getByLabel('Phase 2 duration in minutes').fill('0.5');
  await options.getByLabel('Background color').fill('#80b5f4');
  await options.getByRole('tab', { name: 'Reward Dice' }).click();
  await options.getByLabel('Enable Reward Dice').check();
  await options.getByLabel('Available rerolls').selectOption('1');
  await options.getByLabel('Reward side 1 icon').fill('☕');
  await options.getByLabel('Reward side 1 title').fill('Tea break');
  await options
    .getByLabel('Reward side 1 description')
    .fill('Drink a cup of green tea.');
  await options.getByRole('button', { name: /Select reward side 2/u }).click();
  await options.getByLabel('Reward side 2 icon').fill('🧘');
  await options.getByLabel('Reward side 2 title').fill('Stretch');
  await options
    .getByLabel('Reward side 2 description')
    .fill('Move and release tension.');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options
    .getByRole('status')
    .filter({ hasText: 'Workflow saved' })
    .waitFor();
}

async function createQuickVisualWorkflow(options) {
  await openNewWorkflow(options, 'Quick setup');
  await options.getByLabel('Workflow name').fill('Visual parity quick flow');
  await options.getByLabel('Cycles').fill('4');
  await options.getByLabel('Focus duration in minutes').fill('25');
  await options.getByLabel('Short Break duration in minutes').fill('5');
  await options.getByLabel('Use Long Break').check();
  await options.getByLabel('Long Break every N cycles').fill('4');
  await options.getByLabel('Long Break duration in minutes').fill('15');
  await options.getByLabel('Use Reward Dice').check();
  await options.getByLabel('Reward every N cycles').fill('2');
  await options.getByRole('button', { name: 'Configure sides' }).click();
  await options.getByRole('dialog', { name: 'Reward sides drawer' }).waitFor();
  await options.getByLabel('Reward side 1 icon').fill('☕');
  await options.getByLabel('Reward side 1 title').fill('Tea break');
  await options.getByLabel('Reward side 1 weight').fill('60');
  await options.getByLabel('Reward side 2 icon').fill('🧘');
  await options.getByLabel('Reward side 2 title').fill('Stretch');
  await options.getByLabel('Reward side 2 weight').fill('40');
  await options.evaluate(() => window.scrollTo(0, 0));
  await capture(options, 'quick-setup-composite');
  await options.keyboard.press('Escape');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options
    .getByRole('status')
    .filter({ hasText: 'Workflow saved' })
    .waitFor();
}

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

async function stopSession(focus) {
  await focus.getByRole('button', { name: 'Stop' }).click();
  await focus.getByRole('button', { name: 'Stop session' }).click();
  await focus.getByText('Session stopped').waitFor();
  await focus.getByRole('button', { name: 'Back to workflows' }).click();
}

async function removeAllWorkflows(options) {
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await openWorkflowLibrary(options);
  const deleteButtons = options.getByRole('button', { name: /^Delete /u });
  while ((await deleteButtons.count()) > 0) {
    const button = deleteButtons.first();
    const accessibleName = await button.getAttribute('aria-label');
    if (accessibleName === null) {
      throw new Error('Workflow delete action has no accessible name.');
    }
    await button.evaluate((element) => {
      element.click();
    });
    await options.getByRole('button', { name: 'Delete workflow' }).click();
    await options
      .getByRole('button', { name: accessibleName, exact: true })
      .waitFor({ state: 'detached' });
  }
}

async function verifyCaptureFiles() {
  for (const item of captureDefinitions) {
    const path = resolve(actualCaptureDirectory, item.actualFilename);
    const buffer = await readFile(path);
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`Capture is not a readable PNG: ${item.actualFilename}`);
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width !== item.viewport.width || height !== item.viewport.height) {
      throw new Error(
        `Capture dimensions mismatch for ${item.id}: ${String(width)}×${String(height)}.`,
      );
    }
  }
}

export async function prepareActualCaptureDirectory(
  directory = actualCaptureDirectory,
) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

export async function captureVisualParity() {
  await validateVisualParityManifest(visualParityManifest);
  await prepareActualCaptureDirectory();

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1512, height: 987 },
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
    await options.locator('.workflow-studio-shell__brand-name').waitFor();

    await seedVisualAssets(options);
    await createDetailedImageWorkflow(options);
    await createDetailedVisualWorkflow(options);
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'detailed-reward-dice');
    await options.getByRole('tab', { name: 'Phases' }).click();
    await options
      .getByRole('button', { name: 'Select Phase 2: Important Break' })
      .click();
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'detailed-phases');

    await createQuickVisualWorkflow(options);
    await openWorkflowLibrary(options);
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'workflows-library');

    await options.getByRole('tab', { name: 'Assets' }).click();
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'asset-library');

    await options.getByRole('tab', { name: 'Settings' }).click();
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'settings');

    const sidePanel = await context.newPage();
    await sidePanel.goto(`${extensionRoot}/sidepanel.html`);
    await sidePanel.getByRole('heading', { name: 'Locusora' }).waitFor();
    await capture(sidePanel, 'side-panel-workflows');
    await capture(sidePanel, 'side-panel-workflows-wide');
    await capture(sidePanel, 'side-panel-workflows-narrow');
    await capture(sidePanel, 'side-panel-workflows-200-percent');

    const focus = await context.newPage();
    await focus.goto(`${extensionRoot}/focus.html`);
    await focus.getByRole('heading', { name: 'Choose a Workflow' }).waitFor();
    await focus
      .getByRole('button', { name: 'Start workflow: Visual parity image flow' })
      .click();
    await focus.getByRole('button', { name: 'Pause' }).waitFor();
    await capture(focus, 'focus-image');
    await capture(focus, 'focus-narrow');
    await capture(focus, 'focus-200-percent');
    await capture(sidePanel, 'side-panel-session');
    await focus.getByRole('button', { name: 'Pause' }).click();
    await focus.getByRole('button', { name: 'Resume' }).waitFor();
    await capture(focus, 'focus-paused');
    await focus.getByRole('button', { name: 'Resume' }).click();
    await focus.getByRole('button', { name: 'Stop' }).click();
    await focus.getByRole('dialog', { name: 'Stop this session?' }).waitFor();
    await capture(focus, 'focus-stop-confirmation');
    await focus.getByRole('button', { name: 'Cancel' }).click();
    await stopSession(focus);

    await focus
      .getByRole('button', {
        name: 'Start workflow: Visual parity color flow',
      })
      .click();
    await focus.getByRole('button', { name: 'Pause' }).waitFor();
    await capture(focus, 'focus-color');
    await expireActiveSessionDeadline(focus);
    await focus.getByText('Transitioning to the next phase…').waitFor({
      timeout: 15_000,
    });
    await capture(focus, 'focus-transition');
    await expireActiveSessionDeadline(focus);
    const reward = focus.getByRole('dialog', { name: 'Reward unlocked' });
    await reward.waitFor({ timeout: 15_000 });
    await capture(focus, 'focus-reward-unlocked');
    await reward.getByRole('button', { name: 'Roll dice' }).click();
    await reward.getByRole('heading', { level: 3 }).waitFor({
      timeout: 8_000,
    });
    await capture(focus, 'focus-reward-rolled');
    await reward.getByRole('button', { name: 'Continue' }).click();
    await focus.getByText(/Break · Important Break/u).waitFor();
    await capture(focus, 'focus-break-color');
    await stopSession(focus);

    await removeAllWorkflows(options);
    await focus.reload();
    await focus.getByText('Create a Workflow').waitFor();
    await capture(focus, 'focus-empty');

    const errorPage = await context.newPage();
    await errorPage.addInitScript(() => {
      Object.defineProperty(chrome.runtime, 'sendMessage', {
        configurable: true,
        value: () => Promise.reject(new Error('Visual parity capture error.')),
      });
    });
    await errorPage.goto(`${extensionRoot}/focus.html`);
    await errorPage.getByRole('alert').waitFor();
    await capture(errorPage, 'focus-initialization-error');

    await verifyCaptureFiles();
    console.log(
      `Visual parity capture complete: ${String(captureDefinitions.length)} PNGs.`,
    );
  } finally {
    await context.close();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await captureVisualParity();
}
