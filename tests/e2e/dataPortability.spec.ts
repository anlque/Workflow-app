import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { expect, test } from './extensionFixture';

async function createWorkflow(options: Page, name: string): Promise<void> {
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill(name);
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(
    options.getByRole('button', { name: `Open ${name}` }),
  ).toBeVisible();
}

test('round-trips a selected Workflow package', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await createWorkflow(options, 'Portable focus');
  await options.getByRole('tab', { name: 'Settings' }).click();

  const downloadPromise = options.waitForEvent('download');
  await options.getByRole('button', { name: 'Export workflow' }).click();
  const download = await downloadPromise;
  const packagePath = await download.path();

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Delete Portable focus' }).click();
  await options.getByRole('button', { name: 'Delete workflow' }).click();
  await expect(
    options.getByRole('button', { name: 'Open Portable focus' }),
  ).toHaveCount(0);

  await options.getByRole('tab', { name: 'Settings' }).click();
  await options.getByLabel('Import workflow file').setInputFiles(packagePath);
  await expect(options.getByText('Workflow imported.')).toBeVisible();
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await expect(
    options.getByRole('button', { name: 'Open Portable focus' }),
  ).toBeVisible();
});

test('renames imported Role collisions and keeps references inside the package', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  const bytes = Buffer.from('image');
  const packageJson = JSON.stringify({
    kind: 'locusora/workflow',
    version: 2,
    workflow: {
      id: 'source-workflow',
      name: 'Role package',
      phases: [
        {
          type: 'focus',
          durationSeconds: 60,
          environment: {
            backgroundAsset: { type: 'role', role: 'Backdrop' },
          },
        },
      ],
    },
    assets: [
      {
        id: 'source-image',
        name: 'Backdrop',
        kind: 'image',
        mimeType: 'image/png',
        byteSize: bytes.byteLength,
        role: 'Backdrop',
        dataBase64: bytes.toString('base64'),
      },
    ],
  });
  await options.getByRole('tab', { name: 'Settings' }).click();
  const input = options.getByLabel('Import workflow file');
  const file = {
    name: 'role-package.json',
    mimeType: 'application/json',
    buffer: Buffer.from(packageJson),
  };
  await input.setInputFiles(file);
  await expect(options.getByText('Workflow imported.')).toBeVisible();
  await input.setInputFiles(file);
  await expect(options.getByText('Workflow imported.')).toBeVisible();

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options
    .getByRole('button', { name: 'Open Role package' })
    .last()
    .click();
  await options.getByRole('tab', { name: 'Settings' }).click();
  const downloadPromise = options.waitForEvent('download');
  await options.getByRole('button', { name: 'Export workflow' }).click();
  const path = await (await downloadPromise).path();
  const exported = JSON.parse(await readFile(path, 'utf8')) as {
    workflow: { phases: { environment: { backgroundAsset: unknown } }[] };
    assets: { role?: string }[];
  };

  expect(exported.workflow.phases[0]?.environment.backgroundAsset).toEqual({
    type: 'role',
    role: 'Backdrop (imported)',
  });
  expect(exported.assets[0]?.role).toBe('Backdrop (imported)');
});

test('round-trips application Settings independently', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Settings' }).click();
  await options.getByLabel('Theme').selectOption('dark');
  await expect(options.getByText('Theme updated.')).toBeVisible();

  const downloadPromise = options.waitForEvent('download');
  await options.getByRole('button', { name: 'Export settings' }).click();
  const download = await downloadPromise;
  const packagePath = await download.path();

  await options.getByLabel('Theme').selectOption('light');
  await expect(options.getByText('Theme updated.')).toBeVisible();
  await options.getByLabel('Import settings file').setInputFiles(packagePath);
  await expect(options.getByText('Settings imported.')).toBeVisible();
  await expect(options.getByLabel('Theme')).toHaveValue('dark');
});

test('rejects a corrupt Workflow package without changing existing data', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await createWorkflow(options, 'Keep me');
  await options.getByRole('tab', { name: 'Settings' }).click();

  await options.getByLabel('Import workflow file').setInputFiles({
    name: 'corrupt-workflow.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(options.getByRole('alert')).toContainText(
    'Workflow package is invalid.',
  );

  await options.reload();
  await expect(
    options.getByRole('button', { name: 'Open Keep me' }),
  ).toBeVisible();
});
