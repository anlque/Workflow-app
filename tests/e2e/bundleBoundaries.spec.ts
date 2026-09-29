import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

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

test('Focus initial preload graph excludes Workflow Studio modules', () => {
  const focusHtml = readFileSync(resolve(outputRoot, 'focus.html'), 'utf8');
  const preloadNames = assetPaths(focusHtml, 'modulepreload').map((path) =>
    basename(path),
  );
  const chunkNames = readdirSync(resolve(outputRoot, 'chunks'));

  expect(chunkNames.some((name) => name.startsWith('WorkflowStudio-'))).toBe(
    true,
  );
  expect(
    chunkNames.some((name) =>
      name.startsWith('createWorkflowStudioDependencies-'),
    ),
  ).toBe(true);
  expect(
    preloadNames.filter((name) =>
      /^(?:WorkflowStudio|createWorkflowStudioDependencies)-/u.test(name),
    ),
  ).toEqual([]);

  const [focusEntry] = assetPaths(focusHtml, 'script');
  expect(focusEntry).toBeDefined();
  const entrySource = readFileSync(
    resolve(outputRoot, focusEntry?.replace(/^\//u, '') ?? ''),
    'utf8',
  );
  expect(entrySource).toMatch(/import\([^)]*LazyWorkflowStudio/u);
});
