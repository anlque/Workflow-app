import type { BrowserContext, Page } from '@playwright/test';

import { expect, test, type ExtensionUrls } from './extensionFixture';

async function createWorkflow(
  options: Page,
  name: string,
  durationSeconds: number,
): Promise<void> {
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill(name);
  await options
    .getByLabel('Phase 1 duration in seconds')
    .fill(String(durationSeconds));
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(
    options.getByRole('button', { name: `Open ${name}` }),
  ).toBeVisible();
}

async function startWorkflow(
  context: BrowserContext,
  sidePanel: Page,
  name: string,
): Promise<Page> {
  const focusPagePromise = context.waitForEvent('page');
  await sidePanel.getByRole('button', { name: `Start ${name}` }).click();
  const focus = await focusPagePromise;
  await focus.waitForLoadState('domcontentloaded');
  return focus;
}

async function configuredSurfaces(
  context: BrowserContext,
  extensionUrls: ExtensionUrls,
  name: string,
  durationSeconds: number,
): Promise<Readonly<{ options: Page; sidePanel: Page }>> {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await createWorkflow(options, name, durationSeconds);
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  return { options, sidePanel };
}

test('restores a running Session after every Session surface closes', async ({
  context,
  extensionUrls,
}) => {
  const { options, sidePanel } = await configuredSurfaces(
    context,
    extensionUrls,
    'Restored focus',
    8,
  );
  const focus = await startWorkflow(context, sidePanel, 'Restored focus');
  await expect(
    focus.getByRole('heading', { name: 'Restored focus' }),
  ).toBeVisible();

  await Promise.all([focus.close(), sidePanel.close(), options.close()]);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  const restored = await context.newPage();
  await restored.goto(extensionUrls.focus);
  await expect(
    restored.getByRole('heading', { name: 'Restored focus' }),
  ).toBeVisible();
  const countdown = await restored.getByLabel('Time remaining').textContent();
  expect(countdown).not.toBeNull();
  const remaining = Number(countdown?.split(':')[1]);
  expect(remaining).toBeGreaterThan(0);
  expect(remaining).toBeLessThan(8);
});

test('shows terminal completion from the authoritative alarm transition', async ({
  context,
  extensionUrls,
}) => {
  const { sidePanel } = await configuredSurfaces(
    context,
    extensionUrls,
    'Short focus',
    10,
  );
  const focus = await startWorkflow(context, sidePanel, 'Short focus');
  await expect(
    focus.getByRole('heading', { name: 'Short focus' }),
  ).toBeVisible();

  await expect(focus.getByText('Session complete')).toBeVisible({
    timeout: 15_000,
  });
  await expect(focus.getByRole('button', { name: 'Stop' })).toHaveCount(0);
});
