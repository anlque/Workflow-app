import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  validateVisualParityManifest,
  visualParityManifest,
} from './visualParityManifest.mjs';

test('covers every imported Figma PNG exactly once', async () => {
  const result = await validateVisualParityManifest(visualParityManifest);

  assert.equal(result.referenceCount, 13);
  assert.equal(result.uniqueIdCount, 13);
  assert.equal(result.uniquePathCount, 13);
});

test('rejects duplicate stable IDs and reference paths', async () => {
  const duplicate = [visualParityManifest[0], visualParityManifest[0]];

  await assert.rejects(
    validateVisualParityManifest(duplicate),
    /Duplicate visual parity manifest ID.*Duplicate visual parity reference path/,
  );
});

test('full-screen records match their PNG dimensions', async () => {
  const result = await validateVisualParityManifest(visualParityManifest);

  assert.equal(result.dimensionMismatches.length, 0);
});

test('composite and contract regions define bounded crops and actual evidence', () => {
  const supportingEntries = visualParityManifest.filter(
    ({ comparisonMode }) => comparisonMode !== 'full-screen',
  );

  for (const entry of supportingEntries) {
    assert.ok(entry.regions.length > 0, `${entry.id} has no regions`);
    for (const region of entry.regions) {
      assert.ok(region.referenceCrop.width > 0, `${region.id} crop width`);
      assert.ok(region.referenceCrop.height > 0, `${region.id} crop height`);
      assert.ok(region.actualIds.length > 0, `${region.id} has no actuals`);
    }
  }
});
