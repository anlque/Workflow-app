import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const sourceDirectory = resolve(root, 'assets/brand/source');

const rasterExports = [
  ['locusora-growth-rings.svg', 'public/brand/icon-16.png', 16, 16, 1],
  ['locusora-growth-rings.svg', 'public/brand/icon-32.png', 32, 32, 2],
  ['locusora-growth-rings.svg', 'public/brand/icon-48.png', 48, 48, 3],
  ['locusora-growth-rings.svg', 'public/brand/icon-128.png', 128, 128, 8],
  ['locusora-growth-rings.svg', 'public/brand/favicon-16.png', 16, 16, 1],
  [
    'locusora-growth-rings.svg',
    'store-assets/locusora-store-icon-128.png',
    128,
    128,
    16,
  ],
  [
    'locusora-promo-small.svg',
    'store-assets/locusora-promo-small-440x280.png',
    440,
    280,
    0,
  ],
];

const publicVectors = [
  ['locusora-growth-rings.svg', 'public/brand/locusora-mark.svg'],
  ['locusora-lockup-light.svg', 'public/brand/locusora-lockup-light.svg'],
  ['locusora-lockup-dark.svg', 'public/brand/locusora-lockup-dark.svg'],
];

const browser = await chromium.launch({ channel: 'chromium' });

try {
  for (const [
    sourceName,
    outputPath,
    width,
    height,
    padding,
  ] of rasterExports) {
    const source = await readFile(resolve(sourceDirectory, sourceName), 'utf8');
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}body{box-sizing:border-box;padding:${padding}px}svg{display:block;width:100%;height:100%}</style>${source}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const absoluteOutputPath = resolve(root, outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await page.screenshot({ path: absoluteOutputPath, omitBackground: true });
    await page.close();
  }

  for (const [sourceName, outputPath] of publicVectors) {
    const source = await readFile(resolve(sourceDirectory, sourceName));
    const absoluteOutputPath = resolve(root, outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, source);
  }
} finally {
  await browser.close();
}

console.log(
  `Exported ${rasterExports.length} PNGs and ${publicVectors.length} public SVGs.`,
);
