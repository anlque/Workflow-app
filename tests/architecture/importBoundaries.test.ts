import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import { describe, expect, test } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const sourceRoot = resolve(projectRoot, 'src');

type Violation = Readonly<{
  file: string;
  importedModule: string;
  reason: string;
}>;

const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;

function listTypeScriptFiles(directory: string): readonly string[] {
  return readdirSync(directory)
    .flatMap((entry) => {
      const path = resolve(directory, entry);

      if (statSync(path).isDirectory()) {
        return listTypeScriptFiles(path);
      }

      return /\.tsx?$/.test(entry) ? [path] : [];
    })
    .sort();
}

function findViolations(): readonly Violation[] {
  return listTypeScriptFiles(sourceRoot).flatMap((file) => {
    const projectPath = relative(projectRoot, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(importPattern)].map(
      (match) => match[1],
    );

    return imports.flatMap((importedModule) => {
      if (importedModule === undefined) {
        return [];
      }

      if (/^@\/features\/[^/]+\//.test(importedModule)) {
        return [
          { file: projectPath, importedModule, reason: 'feature deep import' },
        ];
      }

      if (
        !projectPath.startsWith('src/app/') &&
        importedModule.startsWith('@/app/')
      ) {
        return [
          {
            file: projectPath,
            importedModule,
            reason: 'lower module imports app',
          },
        ];
      }

      if (
        projectPath.startsWith('src/platform/') &&
        importedModule.startsWith('@/features/')
      ) {
        return [
          {
            file: projectPath,
            importedModule,
            reason: 'platform imports feature',
          },
        ];
      }

      const isStableLayer = /\/((domain)|(application))\//.test(projectPath);
      const isForbiddenDependency =
        /^(react|wxt|zustand|dexie)(\/|$)/.test(importedModule) ||
        importedModule.startsWith('@/platform/') ||
        importedModule.includes('/infrastructure/') ||
        importedModule.includes('/presentation/');

      return isStableLayer && isForbiddenDependency
        ? [
            {
              file: projectPath,
              importedModule,
              reason: 'stable layer imports unstable dependency',
            },
          ]
        : [];
    });
  });
}

describe('architectural import boundaries', () => {
  test('source tree exists and contains TypeScript modules', () => {
    expect(listTypeScriptFiles(sourceRoot).length).toBeGreaterThan(0);
  });

  test('source imports respect dependency direction and feature public APIs', () => {
    expect(findViolations()).toEqual([]);
  });
});
