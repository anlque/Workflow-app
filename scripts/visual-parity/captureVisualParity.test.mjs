import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  captureDefinitions,
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
