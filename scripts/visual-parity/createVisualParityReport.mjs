import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { captureDefinitions } from './captureVisualParity.mjs';
import {
  actualCaptureDirectory,
  figmaReferenceDirectory,
  validateVisualParityManifest,
  visualParityManifest,
  visualParityRoot,
} from './visualParityManifest.mjs';

const reportPath = resolve(visualParityRoot, 'report.html');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function readPng(path) {
  const buffer = await readFile(path);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Visual parity evidence is not a PNG: ${path}`);
  }
  return {
    dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function captureById(id) {
  const value = captureDefinitions.find((candidate) => candidate.id === id);
  if (value === undefined) throw new Error(`Unknown actual capture ID: ${id}`);
  return value;
}

export async function buildVisualParityReportModel() {
  await validateVisualParityManifest(visualParityManifest);

  const fullScreenPairs = [];
  for (const entry of visualParityManifest.filter(
    ({ comparisonMode }) => comparisonMode === 'full-screen',
  )) {
    const reference = await readPng(
      resolve(figmaReferenceDirectory, entry.referenceFilename),
    );
    const actual = await readPng(
      resolve(actualCaptureDirectory, entry.actualFilename),
    );
    fullScreenPairs.push({ entry, reference, actual });
  }

  const supportingReferences = [];
  for (const entry of visualParityManifest.filter(
    ({ comparisonMode }) => comparisonMode !== 'full-screen',
  )) {
    const reference = await readPng(
      resolve(figmaReferenceDirectory, entry.referenceFilename),
    );
    const regions = [];
    for (const region of entry.regions) {
      const actuals = [];
      for (const id of region.actualIds) {
        const capture = captureById(id);
        actuals.push({
          capture,
          image: await readPng(
            resolve(actualCaptureDirectory, capture.actualFilename),
          ),
        });
      }
      regions.push({ ...region, actuals });
    }
    supportingReferences.push({ entry, reference, regions });
  }

  const consistencyCaptures = [];
  for (const capture of captureDefinitions.filter(
    ({ comparisonMode }) => comparisonMode === 'consistency-only',
  )) {
    consistencyCaptures.push({
      capture,
      image: await readPng(
        resolve(actualCaptureDirectory, capture.actualFilename),
      ),
    });
  }

  return { fullScreenPairs, supportingReferences, consistencyCaptures };
}

function metadata(entry) {
  const viewport = entry.viewport;
  const viewportText =
    viewport === undefined
      ? 'region comparison'
      : `${String(viewport.width)} × ${String(viewport.height)}`;
  const conditions = entry.conditions;
  const dynamic =
    entry.dynamicRegions.length === 0
      ? 'none'
      : entry.dynamicRegions.join(', ');
  return `${viewportText} · ${conditions.colorScheme} · ${conditions.reducedMotion} motion · dynamic: ${dynamic}`;
}

function renderFullScreenPair({ entry, reference, actual }) {
  return `
    <section class="comparison" id="${escapeHtml(entry.id)}">
      <header>
        <div>
          <h2>${escapeHtml(entry.surface)} — ${escapeHtml(entry.state)}</h2>
          <p>${escapeHtml(entry.referenceFilename)}</p>
          <p>${escapeHtml(metadata(entry))}</p>
        </div>
        <div class="controls">
          <button type="button" data-action="fit">Fit</button>
          <button type="button" data-action="native">Native</button>
          <label>Actual opacity <input class="overlay-range" type="range" min="0" max="100" value="50"></label>
        </div>
      </header>
      <div class="side-by-side">
        <figure><figcaption>Figma</figcaption><img src="${reference.dataUrl}" width="${String(reference.width)}" height="${String(reference.height)}" alt=""></figure>
        <figure><figcaption>Application</figcaption><img src="${actual.dataUrl}" width="${String(actual.width)}" height="${String(actual.height)}" alt=""></figure>
      </div>
      <div class="overlay-scroll">
        <div class="comparison-canvas fit" style="width:${String(reference.width)}px;height:${String(reference.height)}px;--aspect:${String(reference.width)} / ${String(reference.height)}">
          <img src="${reference.dataUrl}" width="${String(reference.width)}" height="${String(reference.height)}" alt="">
          <img class="overlay-actual" src="${actual.dataUrl}" width="${String(actual.width)}" height="${String(actual.height)}" alt="" style="opacity:.5">
        </div>
      </div>
    </section>`;
}

function renderSupportingReference({ entry, reference, regions }) {
  const regionHtml = regions
    .map(({ id, label, referenceCrop, actuals }) => {
      const actualHtml = actuals
        .map(
          ({ capture, image }) => `
            <figure>
              <figcaption>${escapeHtml(capture.id)}</figcaption>
              <img src="${image.dataUrl}" width="${String(image.width)}" height="${String(image.height)}" alt="">
            </figure>`,
        )
        .join('');
      return `
        <article class="region" id="${escapeHtml(`${entry.id}-${id}`)}">
          <h3>${escapeHtml(label)}</h3>
          <div class="region-grid">
            <figure>
              <figcaption>Figma region</figcaption>
              <svg viewBox="${String(referenceCrop.x)} ${String(referenceCrop.y)} ${String(referenceCrop.width)} ${String(referenceCrop.height)}" role="img" aria-label="${escapeHtml(label)}">
                <image href="${reference.dataUrl}" width="${String(reference.width)}" height="${String(reference.height)}"></image>
              </svg>
            </figure>
            ${actualHtml}
          </div>
        </article>`;
    })
    .join('');
  return `
    <section class="supporting">
      <header>
        <h2>${escapeHtml(entry.referenceFilename)}</h2>
        <p>${escapeHtml(entry.comparisonMode)} · ${escapeHtml(metadata(entry))}</p>
      </header>
      ${regionHtml}
    </section>`;
}

function renderConsistencyCapture({ capture, image }) {
  return `
    <figure class="consistency-card">
      <figcaption>${escapeHtml(capture.id)} · no exact frame</figcaption>
      <img src="${image.dataUrl}" width="${String(image.width)}" height="${String(image.height)}" alt="">
    </figure>`;
}

export function renderVisualParityReport(model) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Locusora UI-003 visual parity</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background:#111713; color:#eef5f0; }
    * { box-sizing:border-box; }
    body { margin:0; padding:32px; }
    main { display:grid; gap:32px; }
    h1,h2,h3,p { margin-block-start:0; }
    section { border:1px solid #3b5144; border-radius:16px; padding:20px; background:#18221c; }
    header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
    .controls { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
    button { border:1px solid #71917c; border-radius:8px; padding:8px 12px; background:#22382b; color:inherit; }
    .side-by-side,.region-grid,.consistency-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }
    figure { margin:0; min-width:0; }
    figcaption { margin-bottom:8px; color:#bcd1c1; }
    figure img, figure svg { display:block; width:100%; height:auto; border:1px solid #3b5144; background:#fff; }
    .overlay-scroll { max-width:100%; overflow:auto; border:1px solid #3b5144; background:#080b09; }
    .comparison-canvas { position:relative; transform-origin:top left; }
    .comparison-canvas.fit { width:100% !important; height:auto !important; aspect-ratio:var(--aspect); }
    .comparison-canvas img { position:absolute; inset:0; display:block; width:100%; height:100%; }
    .region { padding-block:20px; border-top:1px solid #3b5144; }
    .region-grid { align-items:start; }
    .consistency-card { border:1px solid #3b5144; border-radius:12px; padding:12px; }
    @media (max-width:800px) { body { padding:12px; } header { flex-direction:column; } }
  </style>
</head>
<body>
  <main>
    <h1>Locusora UI-003 visual parity report</h1>
    ${model.fullScreenPairs.map(renderFullScreenPair).join('')}
    ${model.supportingReferences.map(renderSupportingReference).join('')}
    <section><h2>Consistency-only states</h2><div class="consistency-grid">${model.consistencyCaptures.map(renderConsistencyCapture).join('')}</div></section>
  </main>
  <script>
    document.addEventListener('input', (event) => {
      if (!event.target.matches('.overlay-range')) return;
      const comparison = event.target.closest('.comparison');
      comparison.querySelector('.overlay-actual').style.opacity = String(Number(event.target.value) / 100);
    });
    document.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      if (action !== 'fit' && action !== 'native') return;
      const canvas = event.target.closest('.comparison').querySelector('.comparison-canvas');
      canvas.classList.toggle('fit', action === 'fit');
    });
  </script>
</body>
</html>`;
}

export async function createVisualParityReport() {
  const model = await buildVisualParityReportModel();
  await writeFile(reportPath, renderVisualParityReport(model), 'utf8');
  console.log(
    `Visual parity report created: ${String(model.fullScreenPairs.length)} full-screen pairs, ${String(model.supportingReferences.length)} supporting references, ${String(model.consistencyCaptures.length)} consistency captures.`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await createVisualParityReport();
}
