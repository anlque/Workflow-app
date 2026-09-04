import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const failures = [];

const expectedPngs = [
  ['public/brand/icon-16.png', 16, 16, true],
  ['public/brand/icon-32.png', 32, 32, true],
  ['public/brand/icon-48.png', 48, 48, true],
  ['public/brand/icon-128.png', 128, 128, true],
  ['public/brand/favicon-16.png', 16, 16, true],
  ['store-assets/locusora-store-icon-128.png', 128, 128, true],
  ['store-assets/locusora-promo-small-440x280.png', 440, 280, false],
  [
    'store-assets/screenshots/locusora-01-focus-light-1280x800.png',
    1280,
    800,
    false,
  ],
  [
    'store-assets/screenshots/locusora-02-workflow-settings-1280x800.png',
    1280,
    800,
    false,
  ],
  [
    'store-assets/screenshots/locusora-03-reward-ritual-dark-1280x800.png',
    1280,
    800,
    false,
  ],
];

const expectedSvgs = [
  ['assets/brand/source/locusora-growth-rings.svg', '0 0 1024 1024'],
  ['assets/brand/source/locusora-lockup-light.svg', '0 0 1440 420'],
  ['assets/brand/source/locusora-lockup-dark.svg', '0 0 1440 420'],
  ['assets/brand/source/locusora-promo-small.svg', '0 0 440 280'],
  ['public/brand/locusora-mark.svg', '0 0 1024 1024'],
  ['public/brand/locusora-lockup-light.svg', '0 0 1440 420'],
  ['public/brand/locusora-lockup-dark.svg', '0 0 1440 420'],
];

function failure(path, message) {
  failures.push(`${path}: ${message}`);
}

async function verifyPng([path, expectedWidth, expectedHeight, requiresAlpha]) {
  try {
    const bytes = await readFile(resolve(root, path));
    const signature = bytes.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') {
      failure(path, 'not a PNG file');
      return;
    }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const colourType = bytes.readUInt8(25);
    if (width !== expectedWidth || height !== expectedHeight) {
      failure(
        path,
        `expected ${expectedWidth}x${expectedHeight}, received ${width}x${height}`,
      );
    }
    if (requiresAlpha && colourType !== 4 && colourType !== 6) {
      failure(
        path,
        `expected an alpha channel, received PNG colour type ${colourType}`,
      );
    }
  } catch (error) {
    failure(path, error.code === 'ENOENT' ? 'missing' : error.message);
  }
}

async function verifySvg([path, expectedViewBox]) {
  try {
    const source = await readFile(resolve(root, path), 'utf8');
    if (!source.includes(`viewBox="${expectedViewBox}"`)) {
      failure(path, `expected viewBox ${expectedViewBox}`);
    }
    if (!source.includes('<title')) {
      failure(path, 'missing accessible title');
    }
    for (const match of source.matchAll(/font-weight="(\d+)"/g)) {
      const weight = Number(match[1]);
      if (weight < 100 || weight > 900 || weight % 100 !== 0) {
        failure(
          path,
          `font-weight ${String(weight)} is not a portable SVG value`,
        );
      }
    }
  } catch (error) {
    failure(path, error.code === 'ENOENT' ? 'missing' : error.message);
  }
}

async function verifyManifest() {
  const path = '.output/chrome-mv3/manifest.json';
  const expectedIcons = {
    16: 'brand/icon-16.png',
    32: 'brand/icon-32.png',
    48: 'brand/icon-48.png',
    128: 'brand/icon-128.png',
  };
  const expectedActionIcons = {
    16: 'brand/icon-16.png',
    32: 'brand/icon-32.png',
    48: 'brand/icon-48.png',
  };
  try {
    const manifest = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    for (const [size, iconPath] of Object.entries(expectedIcons)) {
      if (manifest.icons?.[size] !== iconPath) {
        failure(path, `icons.${size} must reference ${iconPath}`);
      }
      try {
        await readFile(resolve(root, '.output/chrome-mv3', iconPath));
      } catch {
        failure(path, `icons.${size} target ${iconPath} is missing from build`);
      }
    }
    for (const [size, iconPath] of Object.entries(expectedActionIcons)) {
      if (manifest.action?.default_icon?.[size] !== iconPath) {
        failure(path, `action.default_icon.${size} must reference ${iconPath}`);
      }
    }
  } catch (error) {
    failure(
      path,
      error.code === 'ENOENT' ? 'missing; run pnpm build' : error.message,
    );
  }
}

await Promise.all([
  ...expectedPngs.map(verifyPng),
  ...expectedSvgs.map(verifySvg),
  verifyManifest(),
]);

if (failures.length > 0) {
  console.error(`Brand asset verification failed (${failures.length}):`);
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log(
    `Brand asset verification passed (${expectedPngs.length} PNGs, ${expectedSvgs.length} SVGs).`,
  );
}
