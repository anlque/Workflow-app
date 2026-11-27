import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  captureDefinitions,
  parseCaptureSelection,
  planCaptureRun,
  prepareActualCaptureDirectory,
} from './captureVisualParity.mjs';
import { visualParityManifest } from './visualParityManifest.mjs';

test('covers every manifest state that requires an application capture', () => {
  const captureFiles = new Set(
    captureDefinitions.map(({ actualFilename }) => actualFilename),
  );
  const requiredFiles = visualParityManifest
    .map(({ actualFilename }) => actualFilename)
    .filter((filename) => filename !== undefined);

  for (const filename of requiredFiles) {
    assert.ok(captureFiles.has(filename), `Missing capture: ${filename}`);
  }
});

test('uses unique capture IDs and filenames', () => {
  assert.equal(
    new Set(captureDefinitions.map(({ id }) => id)).size,
    captureDefinitions.length,
  );
  assert.equal(
    new Set(captureDefinitions.map(({ actualFilename }) => actualFilename))
      .size,
    captureDefinitions.length,
  );
});

test('includes consistency evidence without exact Figma frames', () => {
  const consistencyIds = captureDefinitions
    .filter(({ comparisonMode }) => comparisonMode === 'consistency-only')
    .map(({ id }) => id);

  assert.deepEqual(consistencyIds, [
    'focus-paused',
    'focus-transition',
    'focus-stop-confirmation',
    'focus-empty',
    'focus-initialization-error',
    'focus-narrow',
    'focus-200-percent',
    'side-panel-workflows',
    'side-panel-workflows-wide',
    'side-panel-workflows-narrow',
    'side-panel-workflows-200-percent',
    'side-panel-session',
  ]);
});

test('removes stale evidence before a new capture run', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'locusora-visual-parity-'));
  context.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(join(directory, 'stale-diagnostic.png'), 'stale');

  await prepareActualCaptureDirectory(directory);

  assert.deepEqual(await readdir(directory), []);
});

test('selects every capture in the existing order when no IDs are provided', () => {
  assert.deepEqual(
    parseCaptureSelection([]),
    captureDefinitions.map(({ id }) => id),
  );
});

test('plans the complete capture set and stages when no IDs are provided', () => {
  const plan = planCaptureRun([]);

  assert.deepEqual(
    plan.captureIds,
    captureDefinitions.map(({ id }) => id),
  );
  assert.equal(plan.fullCapture, true);
  assert.deepEqual(plan.stages, [
    'options',
    'visual-assets',
    'detailed-image-workflow',
    'detailed-visual-workflow',
    'quick-workflow',
    'side-panel',
    'image-session',
    'color-session',
    'empty-focus',
    'error-focus',
  ]);
});

test('selects one existing capture ID', () => {
  assert.deepEqual(parseCaptureSelection(['detailed-reward-dice']), [
    'detailed-reward-dice',
  ]);
});

test('accepts the pnpm argument separator used by the documented command', () => {
  assert.deepEqual(parseCaptureSelection(['--', 'detailed-reward-dice']), [
    'detailed-reward-dice',
  ]);
});

test('selects multiple capture IDs in request order', () => {
  assert.deepEqual(
    parseCaptureSelection(['detailed-phases', 'detailed-reward-dice']),
    ['detailed-phases', 'detailed-reward-dice'],
  );
});

test('deduplicates repeated capture IDs deterministically', () => {
  assert.deepEqual(
    parseCaptureSelection([
      'detailed-reward-dice',
      'detailed-phases',
      'detailed-reward-dice',
    ]),
    ['detailed-reward-dice', 'detailed-phases'],
  );
});

test('rejects an unknown capture ID with an actionable error', () => {
  assert.throws(
    () => parseCaptureSelection(['not-a-capture']),
    /Unknown capture ID: not-a-capture\. Available IDs:/u,
  );
});

test('exits nonzero with an actionable message for an unknown CLI ID', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./captureVisualParity.mjs', import.meta.url)),
      'not-a-capture',
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Unknown capture ID: not-a-capture\. Available IDs:/u,
  );
});

test('plans management captures from their actual prerequisites', () => {
  assert.deepEqual(planCaptureRun(['settings']).stages, ['options']);
  assert.deepEqual(planCaptureRun(['asset-library']).stages, [
    'options',
    'visual-assets',
  ]);
  assert.deepEqual(planCaptureRun(['workflows-library']).stages, [
    'options',
    'visual-assets',
    'detailed-image-workflow',
    'detailed-visual-workflow',
    'quick-workflow',
  ]);
  assert.deepEqual(planCaptureRun(['side-panel-workflows']).stages, [
    'options',
    'visual-assets',
    'detailed-image-workflow',
    'detailed-visual-workflow',
    'quick-workflow',
    'side-panel',
  ]);
});

test('plans only prerequisites needed by the selected detailed captures', () => {
  const rewardOnly = planCaptureRun(['detailed-reward-dice']);
  assert.deepEqual(rewardOnly.captureIds, ['detailed-reward-dice']);
  assert.deepEqual(rewardOnly.stages, [
    'options',
    'visual-assets',
    'detailed-visual-workflow',
  ]);

  const detailedPair = planCaptureRun([
    'detailed-phases',
    'detailed-reward-dice',
  ]);
  assert.deepEqual(detailedPair.captureIds, [
    'detailed-phases',
    'detailed-reward-dice',
  ]);
  assert.deepEqual(detailedPair.stages, rewardOnly.stages);
  assert.equal(detailedPair.stages.includes('quick-workflow'), false);
  assert.equal(detailedPair.stages.includes('image-session'), false);
  assert.equal(detailedPair.stages.includes('color-session'), false);
});
