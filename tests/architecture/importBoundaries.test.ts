import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';

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

function findImportViolations(
  projectPath: string,
  importedModule: string,
): readonly Violation[] {
  const importedProjectPath = importedModule.startsWith('@/')
    ? normalize(importedModule.replace(/^@\//, 'src/')).split(sep).join('/')
    : importedModule.startsWith('.')
      ? normalize(join(dirname(projectPath), importedModule))
          .split(sep)
          .join('/')
      : null;

  if (
    projectPath.startsWith('src/app/workflow-studio/') &&
    (importedProjectPath === 'src/app/focus' ||
      importedProjectPath?.startsWith('src/app/focus/') === true)
  ) {
    return [
      {
        file: projectPath,
        importedModule,
        reason: 'shared Studio imports Focus surface',
      },
    ];
  }

  const studioPresentationConsumers: Readonly<
    Record<string, readonly string[]>
  > = {
    '@/features/assets/studio': [
      'src/app/workflow-studio/',
      'src/features/workflow/presentation/',
    ],
    '@/features/settings/studio': ['src/app/workflow-studio/'],
    '@/features/workflow/studio': [
      'src/app/workflow-studio/',
      'src/app/side-panel/',
    ],
  };
  const allowedStudioConsumers = studioPresentationConsumers[importedModule];
  const isAllowedStudioPresentationImport = allowedStudioConsumers?.some(
    (prefix) => projectPath.startsWith(prefix),
  );

  if (
    /^@\/features\/[^/]+\//.test(importedModule) &&
    isAllowedStudioPresentationImport !== true
  ) {
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
}

function findViolations(): readonly Violation[] {
  return listTypeScriptFiles(sourceRoot).flatMap((file) => {
    const projectPath = relative(projectRoot, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(importPattern)].map(
      (match) => match[1],
    );

    return imports.flatMap((importedModule) =>
      importedModule === undefined
        ? []
        : findImportViolations(projectPath, importedModule),
    );
  });
}

describe('architectural import boundaries', () => {
  test('source tree exists and contains TypeScript modules', () => {
    expect(listTypeScriptFiles(sourceRoot).length).toBeGreaterThan(0);
  });

  test('source imports respect dependency direction and feature public APIs', () => {
    expect(findViolations()).toEqual([]);
  });

  test('shared Workflow Studio cannot import the Focus surface', () => {
    const studioModule = 'src/app/workflow-studio/Probe.tsx';

    expect(
      [
        '@/app/focus',
        '@/app/focus/FocusApp',
        '@/app/workflow-studio/../focus/FocusApp',
        '../focus',
        '../focus/FocusApp',
        '../document-preferences/useDocumentPreferences',
        '@/features/workflow',
      ].flatMap((importedModule) =>
        findImportViolations(studioModule, importedModule),
      ),
    ).toEqual([
      {
        file: studioModule,
        importedModule: '@/app/focus',
        reason: 'shared Studio imports Focus surface',
      },
      {
        file: studioModule,
        importedModule: '@/app/focus/FocusApp',
        reason: 'shared Studio imports Focus surface',
      },
      {
        file: studioModule,
        importedModule: '@/app/workflow-studio/../focus/FocusApp',
        reason: 'shared Studio imports Focus surface',
      },
      {
        file: studioModule,
        importedModule: '../focus',
        reason: 'shared Studio imports Focus surface',
      },
      {
        file: studioModule,
        importedModule: '../focus/FocusApp',
        reason: 'shared Studio imports Focus surface',
      },
    ]);
  });

  test('Studio presentation entrypoints are limited to approved consumers', () => {
    expect(
      findImportViolations(
        'src/app/workflow-studio/WorkflowStudio.tsx',
        '@/features/workflow/studio',
      ),
    ).toEqual([]);
    expect(
      findImportViolations(
        'src/app/background/bootstrapBackground.ts',
        '@/features/workflow/studio',
      ),
    ).toEqual([
      {
        file: 'src/app/background/bootstrapBackground.ts',
        importedModule: '@/features/workflow/studio',
        reason: 'feature deep import',
      },
    ]);
  });
});
