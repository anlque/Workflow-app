import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, normalize, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

const outputRoot = resolve(import.meta.dirname, '../../.output/chrome-mv3');

function assetPaths(html: string, relation: 'modulepreload' | 'script') {
  const pattern =
    relation === 'modulepreload'
      ? /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/gu
      : /<script[^>]+type="module"[^>]+src="([^"]+)"/gu;
  return [...html.matchAll(pattern)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function collectStaticModuleGraph(entryPaths: readonly string[]) {
  const visited = new Set<string>();
  const visit = (assetPath: string): void => {
    const normalizedPath = normalize(assetPath.replace(/^\//u, '')).replaceAll(
      '\\',
      '/',
    );
    if (visited.has(normalizedPath)) return;
    visited.add(normalizedPath);
    const source = readFileSync(resolve(outputRoot, normalizedPath), 'utf8');
    const imports = source.matchAll(
      /(?:import|export)(?:[^'";]*?from)?[(']([./][^'")]+\.js)['")]/gu,
    );
    for (const match of imports) {
      if (match[1] === undefined || match[0].includes('import(')) continue;
      visit(resolve('/', dirname(normalizedPath), match[1]));
    }
  };
  entryPaths.forEach(visit);
  return visited;
}

test('Focus initial preload graph excludes Workflow Studio modules', () => {
  const focusHtml = readFileSync(resolve(outputRoot, 'focus.html'), 'utf8');
  const chunkNames = readdirSync(resolve(outputRoot, 'chunks'));
  const initialAssetPaths = [
    ...assetPaths(focusHtml, 'script'),
    ...assetPaths(focusHtml, 'modulepreload'),
  ];
  const initialGraph = collectStaticModuleGraph(initialAssetPaths);
  const initialGraphSource = [...initialGraph]
    .map((path) =>
      readFileSync(resolve(outputRoot, path.replace(/^\//u, '')), 'utf8'),
    )
    .join('\n');
  const completeChunkSource = chunkNames
    .map((name) => readFileSync(resolve(outputRoot, 'chunks', name), 'utf8'))
    .join('\n');

  expect(chunkNames.some((name) => name.startsWith('WorkflowStudio-'))).toBe(
    true,
  );
  expect(
    chunkNames.some((name) =>
      name.startsWith('createWorkflowStudioDependencies-'),
    ),
  ).toBe(true);
  expect(initialGraphSource).not.toContain('Create workflow');
  expect(initialGraphSource).not.toContain('Duplicate Phase');
  expect(initialGraphSource).not.toContain('Manage Role');
  expect(initialGraphSource).not.toContain('Workflow saved');
  expect(initialGraphSource).not.toContain('Application settings');
  expect(completeChunkSource).toContain('Create workflow');
  expect(completeChunkSource).toContain('Duplicate Phase');
  expect(completeChunkSource).toContain('Manage Role');
  expect(completeChunkSource).toContain('Workflow saved');
  expect(completeChunkSource).toContain('Application settings');

  const [focusEntry] = assetPaths(focusHtml, 'script');
  expect(focusEntry).toBeDefined();
  const entrySource = readFileSync(
    resolve(outputRoot, focusEntry?.replace(/^\//u, '') ?? ''),
    'utf8',
  );
  expect(entrySource).toMatch(/import\([^)]*LazyWorkflowStudio/u);
});

test('production bundle contains the approved Reward Dice media and audio cues', () => {
  for (const path of [
    'video/reward-dice-roll.webm',
    'video/reward-dice-final.png',
    'audio/dice-roll.mp3',
    'audio/session-complete.mp3',
  ]) {
    expect(readFileSync(resolve(outputRoot, path))).toEqual(
      readFileSync(resolve(import.meta.dirname, '../../public', path)),
    );
  }

  expect(
    createHash('sha256')
      .update(readFileSync(resolve(outputRoot, 'audio/session-complete.mp3')))
      .digest('hex'),
  ).toBe('db88cbaf8233e98c72bb35b029aa5f191efd77925ac9c0b0c2d867777e0a8158');
  expect(
    createHash('sha256')
      .update(readFileSync(resolve(outputRoot, 'audio/phase-bell.mp3')))
      .digest('hex'),
  ).toBe('6a22a9a4663344c7a22b0a785c383ebca2d9bb9ddc0cf62ca49e09a083faec02');
});
