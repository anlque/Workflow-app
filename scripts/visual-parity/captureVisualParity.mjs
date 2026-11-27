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

const captureIds = Object.freeze(captureDefinitions.map(({ id }) => id));

const stageCaptureIds = Object.freeze({
  detailed: ['detailed-phases', 'detailed-reward-dice'],
  quick: ['quick-setup-composite'],
  workflowLibrary: ['workflows-library'],
  assetLibrary: ['asset-library'],
  sidePanelWorkflows: [
    'side-panel-workflows',
    'side-panel-workflows-wide',
    'side-panel-workflows-narrow',
    'side-panel-workflows-200-percent',
  ],
  sidePanel: [
    'side-panel-workflows',
    'side-panel-workflows-wide',
    'side-panel-workflows-narrow',
    'side-panel-workflows-200-percent',
    'side-panel-session',
  ],
  imageSession: [
    'focus-image',
    'focus-narrow',
    'focus-200-percent',
    'side-panel-session',
    'focus-paused',
    'focus-stop-confirmation',
  ],
  colorSession: [
    'focus-color',
    'focus-transition',
    'focus-reward-unlocked',
    'focus-reward-rolled',
    'focus-break-color',
  ],
  emptyFocus: ['focus-empty'],
  errorFocus: ['focus-initialization-error'],
});

function includesAny(selectedIds, candidates) {
  return candidates.some((id) => selectedIds.includes(id));
}

export function parseCaptureSelection(requestedIds) {
  const normalizedIds =
    requestedIds[0] === '--' ? requestedIds.slice(1) : requestedIds;
  if (normalizedIds.length === 0) return [...captureIds];
  const selectedIds = [...new Set(normalizedIds)];
  for (const id of selectedIds) {
    if (!captureIds.includes(id)) {
      throw new Error(
        `Unknown capture ID: ${id}. Available IDs: ${captureIds.join(', ')}`,
      );
    }
  }
  return selectedIds;
}

export function planCaptureRun(requestedIds) {
  const selectedIds = parseCaptureSelection(requestedIds);
  const fullCapture =
    requestedIds.length === 0 ||
    (requestedIds.length === 1 && requestedIds[0] === '--');
  const stages = [];
  const needsDetailed = includesAny(selectedIds, stageCaptureIds.detailed);
  const needsQuick = includesAny(selectedIds, stageCaptureIds.quick);
  const needsAssetLibrary = includesAny(
    selectedIds,
    stageCaptureIds.assetLibrary,
  );
  const needsWorkflowFixtures = includesAny(selectedIds, [
    ...stageCaptureIds.workflowLibrary,
    ...stageCaptureIds.sidePanelWorkflows,
  ]);
  const needsSidePanel = includesAny(selectedIds, stageCaptureIds.sidePanel);
  const needsImageSession = includesAny(
    selectedIds,
    stageCaptureIds.imageSession,
  );
  const needsColorSession = includesAny(
    selectedIds,
    stageCaptureIds.colorSession,
  );
  const needsEmptyFocus = includesAny(selectedIds, stageCaptureIds.emptyFocus);
  const needsErrorFocus = includesAny(selectedIds, stageCaptureIds.errorFocus);
  const needsOptions = selectedIds.some(
    (id) => !stageCaptureIds.errorFocus.includes(id),
  );

  if (needsOptions) stages.push('options');
  if (
    needsDetailed ||
    needsAssetLibrary ||
    needsWorkflowFixtures ||
    needsImageSession ||
    needsColorSession
  ) {
    stages.push('visual-assets');
  }
  if (needsWorkflowFixtures || needsImageSession) {
    stages.push('detailed-image-workflow');
  }
  if (needsDetailed || needsWorkflowFixtures || needsColorSession) {
    stages.push('detailed-visual-workflow');
  }
  if (needsQuick || needsWorkflowFixtures) stages.push('quick-workflow');
  if (needsSidePanel) stages.push('side-panel');
  if (needsImageSession) stages.push('image-session');
  if (needsColorSession) stages.push('color-session');
  if (needsEmptyFocus) stages.push('empty-focus');
  if (needsErrorFocus) stages.push('error-focus');

  return Object.freeze({
    captureIds: Object.freeze(selectedIds),
    stages: Object.freeze(stages),
    fullCapture,
  });
}

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
  await options.getByLabel('Reward side 1 weight').fill('25');
  await options.getByRole('button', { name: /Select reward side 2/u }).click();
  await options.getByLabel('Reward side 2 icon').fill('🧘');
  await options.getByLabel('Reward side 2 title').fill('Stretch');
  await options
    .getByLabel('Reward side 2 description')
    .fill('Move and release tension.');
  await options.getByLabel('Reward side 2 availability').selectOption('early');
  await options.getByLabel('Reward side 2 weight').fill('20');
  const extraSides = [
    {
      icon: '🌿',
      title: 'Fresh air',
      description: 'Step outside.',
      availability: 'late',
      weight: '20',
    },
    {
      icon: '🎧',
      title: 'One song',
      description: 'Listen without multitasking.',
      availability: 'any',
      weight: '15',
    },
    {
      icon: '✨',
      title: 'Bonus focus',
      description: 'Continue with a gentler phase.',
      availability: 'late',
      weight: '20',
    },
  ];
  for (const [offset, side] of extraSides.entries()) {
    const sideNumber = offset + 3;
    await options.getByRole('button', { name: 'Add reward side' }).click();
    await options
      .getByRole('button', {
        name: `Select reward side ${String(sideNumber)}: Side ${String(sideNumber)}`,
      })
      .click();
    await options
      .getByLabel(`Reward side ${String(sideNumber)} icon`)
      .fill(side.icon);
    await options
      .getByLabel(`Reward side ${String(sideNumber)} title`)
      .fill(side.title);
    await options
      .getByLabel(`Reward side ${String(sideNumber)} description`)
      .fill(side.description);
    await options
      .getByLabel(`Reward side ${String(sideNumber)} availability`)
      .selectOption(side.availability);
    await options
      .getByLabel(`Reward side ${String(sideNumber)} weight`)
      .fill(side.weight);
  }
  await options.getByLabel('Enable Bonus Phase for side 5').check();
  await options.getByLabel('Side 5 Bonus Phase name').fill('Gentle reset');
  await options.getByLabel('Side 5 Bonus Phase duration in minutes').fill('8');
  await options.getByLabel('Side 5 Bonus Phase background image').selectOption({
    label: 'visual-parity-image.webp',
  });
  await options.getByLabel('Side 5 Bonus Phase ambient audio').selectOption({
    label: 'visual-parity-audio.ogg',
  });
  await options
    .getByLabel('Side 5 Bonus Phase background color')
    .fill('#5f806f');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options
    .getByRole('status')
    .filter({ hasText: 'Workflow saved' })
    .waitFor();
}

async function createQuickVisualWorkflow(options, captureQuickSetup) {
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
  if (captureQuickSetup) {
    await options.evaluate(() => window.scrollTo(0, 0));
    await capture(options, 'quick-setup-composite');
  }
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
  const rows = options.locator('.workflow-list__item');
  while ((await rows.count()) > 0) {
    const row = rows.first();
    const workflowName = await row.getAttribute('aria-label');
    if (workflowName === null) {
      throw new Error('Workflow row has no accessible name.');
    }
    await row
      .getByRole('button', { name: `More actions for ${workflowName}` })
      .click();
    await row.getByRole('button', { name: `Delete ${workflowName}` }).click();
    await options.getByRole('button', { name: 'Delete workflow' }).click();
    await options
      .getByRole('listitem', { name: workflowName, exact: true })
      .waitFor({ state: 'detached' });
  }
}

async function verifyCaptureFiles(selectedIds) {
  for (const item of captureDefinitions.filter(({ id }) =>
    selectedIds.includes(id),
  )) {
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

export async function captureVisualParity(requestedIds = []) {
  const plan = planCaptureRun(requestedIds);
  const selectedIds = new Set(plan.captureIds);
  const stages = new Set(plan.stages);
  const selected = (id) => selectedIds.has(id);

  await validateVisualParityManifest(visualParityManifest);
  if (plan.fullCapture) await prepareActualCaptureDirectory();
  else await mkdir(actualCaptureDirectory, { recursive: true });

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

    let options;
    let sidePanel;
    let focus;

    if (stages.has('options')) {
      options = await context.newPage();
      await options.goto(`${extensionRoot}/options.html`);
      await options.locator('.workflow-studio-shell__brand-name').waitFor();
    }
    if (stages.has('visual-assets')) await seedVisualAssets(options);
    if (stages.has('detailed-image-workflow')) {
      await createDetailedImageWorkflow(options);
    }
    if (stages.has('detailed-visual-workflow')) {
      await createDetailedVisualWorkflow(options);
    }
    if (selected('detailed-reward-dice')) {
      await options.evaluate(() => window.scrollTo(0, 0));
      await capture(options, 'detailed-reward-dice');
    }
    if (selected('detailed-phases')) {
      await options.getByRole('tab', { name: 'Phases' }).click();
      await options
        .getByRole('button', { name: 'Select Phase 2: Important Break' })
        .click();
      await options.evaluate(() => window.scrollTo(0, 0));
      await capture(options, 'detailed-phases');
    }
    if (stages.has('quick-workflow')) {
      await createQuickVisualWorkflow(
        options,
        selected('quick-setup-composite'),
      );
    }
    if (selected('workflows-library')) {
      await openWorkflowLibrary(options);
      await options.evaluate(() => window.scrollTo(0, 0));
      await capture(options, 'workflows-library');
    }
    if (selected('asset-library')) {
      await options.getByRole('tab', { name: 'Assets' }).click();
      await options.evaluate(() => window.scrollTo(0, 0));
      await capture(options, 'asset-library');
    }
    if (selected('settings')) {
      await options.getByRole('tab', { name: 'Settings' }).click();
      await options.evaluate(() => window.scrollTo(0, 0));
      await capture(options, 'settings');
    }

    if (stages.has('side-panel')) {
      sidePanel = await context.newPage();
      await sidePanel.goto(`${extensionRoot}/sidepanel.html`);
      await sidePanel.getByRole('heading', { name: 'Locusora' }).waitFor();
      for (const id of stageCaptureIds.sidePanel.slice(0, 4)) {
        if (selected(id)) await capture(sidePanel, id);
      }
    }

    if (stages.has('image-session') || stages.has('color-session')) {
      focus = await context.newPage();
      await focus.goto(`${extensionRoot}/focus.html`);
      await focus.getByRole('heading', { name: 'Choose a Workflow' }).waitFor();
    }

    if (stages.has('image-session')) {
      await focus
        .getByRole('button', {
          name: 'Start workflow: Visual parity image flow',
        })
        .click();
      await focus.getByRole('button', { name: 'Pause' }).waitFor();
      for (const id of ['focus-image', 'focus-narrow', 'focus-200-percent']) {
        if (selected(id)) await capture(focus, id);
      }
      if (selected('side-panel-session')) {
        await capture(sidePanel, 'side-panel-session');
      }

      const mustPause =
        selected('focus-paused') ||
        selected('focus-stop-confirmation') ||
        stages.has('color-session') ||
        stages.has('empty-focus');
      if (mustPause) {
        await focus.getByRole('button', { name: 'Pause' }).click();
        await focus.getByRole('button', { name: 'Resume' }).waitFor();
        if (selected('focus-paused')) await capture(focus, 'focus-paused');
        await focus.getByRole('button', { name: 'Resume' }).click();
      }
      if (selected('focus-stop-confirmation')) {
        await focus.getByRole('button', { name: 'Stop' }).click();
        await focus
          .getByRole('dialog', { name: 'Stop this session?' })
          .waitFor();
        await capture(focus, 'focus-stop-confirmation');
        await focus.getByRole('button', { name: 'Cancel' }).click();
      }
      if (stages.has('color-session') || stages.has('empty-focus')) {
        await stopSession(focus);
      }
    }

    if (stages.has('color-session')) {
      await focus
        .getByRole('button', {
          name: 'Start workflow: Visual parity color flow',
        })
        .click();
      await focus.getByRole('button', { name: 'Pause' }).waitFor();
      if (selected('focus-color')) await capture(focus, 'focus-color');

      const needsTransition = stageCaptureIds.colorSession
        .slice(1)
        .some(selected);
      if (needsTransition) {
        await expireActiveSessionDeadline(focus);
        await focus.getByText('Transitioning to the next phase…').waitFor({
          timeout: 15_000,
        });
        if (selected('focus-transition')) {
          await capture(focus, 'focus-transition');
        }
      }

      const needsReward =
        selected('focus-reward-unlocked') ||
        selected('focus-reward-rolled') ||
        selected('focus-break-color') ||
        stages.has('empty-focus');
      let reward;
      if (needsReward) {
        await expireActiveSessionDeadline(focus);
        reward = focus.getByRole('dialog', { name: 'Reward unlocked' });
        await reward.waitFor({ timeout: 15_000 });
        if (selected('focus-reward-unlocked')) {
          await capture(focus, 'focus-reward-unlocked');
        }
      }
      const needsRoll =
        selected('focus-reward-rolled') ||
        selected('focus-break-color') ||
        stages.has('empty-focus');
      if (needsRoll) {
        await reward.getByRole('button', { name: 'Roll dice' }).click();
        await reward.getByRole('heading', { level: 3 }).waitFor({
          timeout: 8_000,
        });
        if (selected('focus-reward-rolled')) {
          await capture(focus, 'focus-reward-rolled');
        }
      }
      if (selected('focus-break-color') || stages.has('empty-focus')) {
        await reward.getByRole('button', { name: 'Continue' }).click();
        await focus.getByRole('heading', { name: 'Important Break' }).waitFor();
        if (selected('focus-break-color')) {
          await capture(focus, 'focus-break-color');
        }
      }
      if (stages.has('empty-focus')) await stopSession(focus);
    }

    if (stages.has('empty-focus')) {
      await removeAllWorkflows(options);
      focus ??= await context.newPage();
      await focus.goto(`${extensionRoot}/focus.html`);
      await focus.getByText('Create a Workflow').waitFor();
      await capture(focus, 'focus-empty');
    }

    if (stages.has('error-focus')) {
      const errorPage = await context.newPage();
      await errorPage.addInitScript(() => {
        Object.defineProperty(chrome.runtime, 'sendMessage', {
          configurable: true,
          value: () =>
            Promise.reject(new Error('Visual parity capture error.')),
        });
      });
      await errorPage.goto(`${extensionRoot}/focus.html`);
      await errorPage.getByRole('alert').waitFor();
      await capture(errorPage, 'focus-initialization-error');
    }

    await verifyCaptureFiles(plan.captureIds);
    console.log(
      `Visual parity capture complete: ${String(plan.captureIds.length)} PNGs.`,
    );
  } finally {
    await context.close();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await captureVisualParity(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
