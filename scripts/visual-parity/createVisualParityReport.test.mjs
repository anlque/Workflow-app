import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildVisualParityReportModel,
  renderVisualParityReport,
} from './createVisualParityReport.mjs';

test('builds full-screen overlay pairs and supporting reference regions', async () => {
  const model = await buildVisualParityReportModel();

  assert.equal(model.fullScreenPairs.length, 10);
  assert.equal(model.supportingReferences.length, 3);
  assert.ok(
    model.supportingReferences.every(({ regions }) =>
      regions.every(
        ({ referenceCrop, actuals }) =>
          referenceCrop.width > 0 && actuals.length > 0,
      ),
    ),
  );
});

test('renders a self-contained report with overlay and native-scale controls', async () => {
  const html = renderVisualParityReport(await buildVisualParityReportModel());

  assert.match(html, /data:image\/png;base64,/u);
  assert.match(html, /class="overlay-range"/u);
  assert.match(html, /data-action="native"/u);
  assert.match(html, /data-action="fit"/u);
  assert.doesNotMatch(html, /tmp\/visual-parity\/figma/u);
});
