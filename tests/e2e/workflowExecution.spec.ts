import { expect, test } from './extensionFixture';

test('loads every MVP extension surface in an isolated profile', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await expect(
    options.getByRole('heading', { name: 'Flowarium' }),
  ).toBeVisible();

  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await expect(
    sidePanel.getByRole('heading', { name: 'Flowarium' }),
  ).toBeVisible();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await expect(
    focus.getByRole('heading', { name: 'No active session' }),
  ).toBeVisible();
});

test('creates and controls a Workflow across extension contexts', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('E2E focus');
  await options.getByLabel('Phase 1 duration in seconds').fill('10');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(
    options.getByRole('button', { name: 'Open E2E focus' }),
  ).toBeVisible();

  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  const focusPagePromise = context.waitForEvent('page');
  await sidePanel.getByRole('button', { name: 'Start E2E focus' }).click();
  const focus = await focusPagePromise;
  await focus.waitForLoadState('domcontentloaded');

  await expect(focus.getByRole('heading', { name: 'E2E focus' })).toBeVisible();
  await focus.getByRole('button', { name: 'Pause' }).click();
  await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible();
  await focus.getByRole('button', { name: 'Resume' }).click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  await focus.getByRole('button', { name: 'Stop' }).click();
  await focus.getByRole('button', { name: 'Stop session' }).click();
  await expect(focus.getByText('Session stopped')).toBeVisible();
});
