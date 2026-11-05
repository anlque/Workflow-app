import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const visualParityRoot = resolve(repositoryRoot, 'tmp/visual-parity');
export const figmaReferenceDirectory = resolve(visualParityRoot, 'figma');
export const actualCaptureDirectory = resolve(visualParityRoot, 'actual');

export const visualParityManifest = Object.freeze([
  {
    id: 'workflows-library',
    surface: 'Workflow Library',
    state: 'Populated library',
    referenceFilename: 'Locusora Workflows Library.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 1074 },
    actualFilename: 'workflows-library.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    dynamicRegions: [],
  },
  {
    id: 'asset-library',
    surface: 'Asset Library',
    state: 'Populated library with selected image',
    referenceFilename: 'Locusora Asset Library.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1529, height: 1159 },
    actualFilename: 'asset-library.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    dynamicRegions: ['audio progress'],
  },
  {
    id: 'settings',
    surface: 'Settings',
    state: 'Application settings',
    referenceFilename: 'Locusora Settings.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 1134 },
    actualFilename: 'settings.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    dynamicRegions: [],
  },
  {
    id: 'detailed-phases',
    surface: 'Workflow Studio',
    state: 'Detailed Setup / Phases',
    referenceFilename: 'Workflow Studio · Detailed setup - Phases tab.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1440, height: 1024 },
    actualFilename: 'detailed-phases.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    dynamicRegions: [],
  },
  {
    id: 'detailed-reward-dice',
    surface: 'Workflow Studio',
    state: 'Detailed Setup / Reward Dice / Frequency',
    referenceFilename: 'Workflow Studio · Reward Dice · Frequency.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1440, height: 1262 },
    actualFilename: 'detailed-reward-dice.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    dynamicRegions: [],
  },
  {
    id: 'focus-image',
    surface: 'Focus',
    state: 'Running Focus with image background',
    referenceFilename: 'Locusora — Focus.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 987 },
    actualFilename: 'focus-image.png',
    conditions: { colorScheme: 'dark', reducedMotion: 'reduce' },
    dynamicRegions: ['countdown'],
  },
  {
    id: 'focus-color',
    surface: 'Focus',
    state: 'Running Focus with color background',
    referenceFilename: 'Locusora — Focus - Color background.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 987 },
    actualFilename: 'focus-color.png',
    conditions: { colorScheme: 'dark', reducedMotion: 'reduce' },
    dynamicRegions: ['countdown'],
  },
  {
    id: 'focus-break-color',
    surface: 'Focus',
    state: 'Running Break with color background',
    referenceFilename: 'Locusora Focus - Color background - Break phase.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 987 },
    actualFilename: 'focus-break-color.png',
    conditions: { colorScheme: 'dark', reducedMotion: 'reduce' },
    dynamicRegions: ['countdown'],
  },
  {
    id: 'focus-reward-unlocked',
    surface: 'Focus',
    state: 'Reward pre-roll',
    referenceFilename: 'Locusora — Focus - Reward unlocked.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 987 },
    actualFilename: 'focus-reward-unlocked.png',
    conditions: { colorScheme: 'dark', reducedMotion: 'reduce' },
    dynamicRegions: [],
  },
  {
    id: 'focus-reward-rolled',
    surface: 'Focus',
    state: 'Reward result',
    referenceFilename: 'Locusora - Focus - Reward rolled.png',
    comparisonMode: 'full-screen',
    viewport: { width: 1512, height: 987 },
    actualFilename: 'focus-reward-rolled.png',
    conditions: { colorScheme: 'dark', reducedMotion: 'reduce' },
    dynamicRegions: ['dice video final frame'],
  },
  {
    id: 'quick-setup-composite',
    surface: 'Workflow Studio',
    state: 'Quick Setup composite reference',
    referenceFilename: 'Locusora Workflow Studio _ Quick Setup Mode.png',
    comparisonMode: 'composite-regions',
    actualFilename: 'quick-setup.png',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    regions: [
      {
        id: 'workflow-switcher',
        label: 'Workflow switcher',
        referenceCrop: { x: 125, y: 0, width: 185, height: 292 },
        actualIds: ['quick-setup-composite'],
      },
      {
        id: 'mode-menu',
        label: 'Setup mode menu',
        referenceCrop: { x: 448, y: 175, width: 182, height: 122 },
        actualIds: ['quick-setup-composite'],
      },
      {
        id: 'quick-setup',
        label: 'Quick Setup main form',
        referenceCrop: { x: 306, y: 333, width: 800, height: 1010 },
        actualIds: ['quick-setup-composite'],
      },
      {
        id: 'reward-sides-drawer',
        label: 'Reward Dice sides drawer',
        referenceCrop: { x: 1105, y: 333, width: 445, height: 1010 },
        actualIds: ['quick-setup-composite'],
      },
    ],
    dynamicRegions: [],
  },
  {
    id: 'local-components',
    surface: 'Design system',
    state: 'Local component inventory',
    referenceFilename: 'Locusora · Local Components.png',
    comparisonMode: 'composite-regions',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    regions: [
      {
        id: 'general',
        label: 'General controls',
        referenceCrop: { x: 95, y: 70, width: 1060, height: 500 },
        actualIds: ['workflows-library', 'detailed-phases'],
      },
      {
        id: 'detailed-setup',
        label: 'Detailed Setup primitives',
        referenceCrop: { x: 95, y: 560, width: 1120, height: 590 },
        actualIds: ['detailed-phases', 'detailed-reward-dice'],
      },
      {
        id: 'sidebar',
        label: 'Application sidebar',
        referenceCrop: { x: 95, y: 1130, width: 620, height: 560 },
        actualIds: ['workflows-library', 'asset-library', 'settings'],
      },
      {
        id: 'quick-setup',
        label: 'Quick Setup primitives',
        referenceCrop: { x: 95, y: 1680, width: 1120, height: 1030 },
        actualIds: ['quick-setup-composite'],
      },
      {
        id: 'asset-library',
        label: 'Asset Library primitives',
        referenceCrop: { x: 95, y: 2700, width: 1120, height: 680 },
        actualIds: ['asset-library'],
      },
      {
        id: 'settings',
        label: 'Settings primitives',
        referenceCrop: { x: 95, y: 3350, width: 1120, height: 610 },
        actualIds: ['settings'],
      },
      {
        id: 'workflow-library',
        label: 'Workflow Library rows',
        referenceCrop: { x: 95, y: 3940, width: 1120, height: 620 },
        actualIds: ['workflows-library'],
      },
      {
        id: 'focus',
        label: 'Focus primitives',
        referenceCrop: { x: 95, y: 4520, width: 1500, height: 780 },
        actualIds: ['focus-image', 'focus-color'],
      },
      {
        id: 'tokens',
        label: 'Colors and typography',
        referenceCrop: { x: 95, y: 5250, width: 1500, height: 526 },
        actualIds: ['workflows-library', 'focus-image'],
      },
    ],
    dynamicRegions: [],
  },
  {
    id: 'visual-behavior-spec',
    surface: 'Design system',
    state: 'UI-001 behavior contract',
    referenceFilename: 'UI-001 · Visual behavior spec.png',
    comparisonMode: 'contract',
    conditions: { colorScheme: 'light', reducedMotion: 'reduce' },
    regions: [
      {
        id: 'themes',
        label: 'Application shell Light / Dark',
        referenceCrop: { x: 30, y: 135, width: 1175, height: 250 },
        actualIds: ['workflows-library', 'settings', 'side-panel-workflows'],
      },
      {
        id: 'studio-layouts',
        label: 'Narrow Studio and Side Panel',
        referenceCrop: { x: 30, y: 410, width: 1175, height: 305 },
        actualIds: [
          'detailed-phases',
          'quick-setup-composite',
          'side-panel-workflows',
        ],
      },
      {
        id: 'zoom',
        label: '200% zoom and overflow rules',
        referenceCrop: { x: 30, y: 740, width: 1175, height: 115 },
        actualIds: [
          'workflows-library',
          'detailed-phases',
          'focus-image',
          'side-panel-session',
        ],
      },
      {
        id: 'primitive-states',
        label: 'Core primitive states',
        referenceCrop: { x: 30, y: 880, width: 1215, height: 130 },
        actualIds: ['workflows-library', 'detailed-phases', 'focus-image'],
      },
    ],
    dynamicRegions: [],
  },
]);

async function readPngDimensions(path) {
  const buffer = await readFile(path);
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a' || buffer.length < 24) {
    throw new Error(`Visual parity reference is not a readable PNG: ${path}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export async function validateVisualParityManifest(manifest) {
  const errors = [];
  const ids = manifest.map((entry) => entry.id);
  const paths = manifest.map((entry) => entry.referenceFilename);
  const uniqueIds = new Set(ids);
  const uniquePaths = new Set(paths);

  if (uniqueIds.size !== ids.length) {
    errors.push('Duplicate visual parity manifest ID.');
  }
  if (uniquePaths.size !== paths.length) {
    errors.push('Duplicate visual parity reference path.');
  }

  const importedPngs = (await readdir(figmaReferenceDirectory))
    .filter((filename) => filename.toLowerCase().endsWith('.png'))
    .sort();
  const manifestPngs = [...uniquePaths].sort();
  const uncovered = importedPngs.filter(
    (filename) => !uniquePaths.has(filename),
  );
  const unknown = manifestPngs.filter(
    (filename) => !importedPngs.includes(filename),
  );
  if (uncovered.length > 0) {
    errors.push(`Uncovered Figma PNGs: ${uncovered.join(', ')}.`);
  }
  if (unknown.length > 0) {
    errors.push(`Missing Figma PNGs: ${unknown.join(', ')}.`);
  }

  const dimensionMismatches = [];
  for (const entry of manifest) {
    const path = resolve(figmaReferenceDirectory, entry.referenceFilename);
    const dimensions = await readPngDimensions(path);
    if (
      entry.comparisonMode === 'full-screen' &&
      (entry.viewport?.width !== dimensions.width ||
        entry.viewport?.height !== dimensions.height)
    ) {
      dimensionMismatches.push({
        id: entry.id,
        expected: entry.viewport,
        actual: dimensions,
      });
    }
  }
  if (dimensionMismatches.length > 0) {
    errors.push(
      `Full-screen dimension mismatches: ${dimensionMismatches
        .map(({ id }) => id)
        .join(', ')}.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  return {
    referenceCount: manifest.length,
    uniqueIdCount: uniqueIds.size,
    uniquePathCount: uniquePaths.size,
    dimensionMismatches,
  };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await validateVisualParityManifest(visualParityManifest);
  console.log(
    `Visual parity manifest valid: ${result.referenceCount} unique readable PNGs.`,
  );
}
