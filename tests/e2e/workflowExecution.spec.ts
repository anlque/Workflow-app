import type { Locator } from '@playwright/test';

import { expect, expireActiveSessionDeadline, test } from './extensionFixture';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
  'base64',
);

async function expectViewportCentered(dialog: Locator): Promise<void> {
  const offset = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      horizontal: Math.abs(bounds.left + bounds.width / 2 - innerWidth / 2),
      vertical: Math.abs(bounds.top + bounds.height / 2 - innerHeight / 2),
    };
  });
  expect(offset.horizontal).toBeLessThan(2);
  expect(offset.vertical).toBeLessThan(2);
}

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
    focus.getByRole('heading', { name: 'Choose a Workflow' }),
  ).toBeVisible();
});

test('opens the Options page directly from an empty Focus Tab', async ({
  context,
  extensionUrls,
}) => {
  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);

  const optionsPage = context.waitForEvent('page');
  await focus.getByRole('button', { name: 'Create a Workflow' }).click();
  const options = await optionsPage;

  await expect(options).toHaveURL(extensionUrls.options);
  await expect(
    options.getByRole('heading', { name: 'Flowarium' }),
  ).toBeVisible();
});

test('synchronizes an open Workflow Library after Options changes', async ({
  context,
  extensionUrls,
}) => {
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await expect(
    sidePanel.getByText('Build your first focus rhythm.'),
  ).toBeVisible();

  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Synced focus');
  await options.getByRole('button', { name: 'Save workflow' }).click();

  await expect(
    sidePanel.getByRole('button', { name: 'Open Synced focus' }),
  ).toBeVisible();

  await options.getByLabel('Workflow name').fill('Renamed focus');
  await options.getByRole('button', { name: 'Save workflow' }).click();

  await expect(
    sidePanel.getByRole('button', { name: 'Open Renamed focus' }),
  ).toBeVisible();
  await expect(
    sidePanel.getByRole('button', { name: 'Open Synced focus' }),
  ).not.toBeVisible();
});

test('creates and controls a Workflow across extension contexts', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('E2E focus');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(options.getByRole('status')).toHaveText('Workflow saved');
  await expect(
    options.getByRole('button', { name: 'Open E2E focus' }),
  ).toBeVisible();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await focus.getByRole('button', { name: 'Start E2E focus' }).click();

  await expect(focus.getByRole('heading', { name: 'E2E focus' })).toBeVisible();
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await sidePanel.getByRole('button', { name: 'Back to workflows' }).click();
  await expect(
    sidePanel.getByRole('button', { name: 'Open E2E focus' }),
  ).toBeVisible();
  await expect(
    sidePanel.getByRole('region', { name: 'Active session summary' }),
  ).toBeVisible();
  await sidePanel.getByRole('button', { name: 'Return to session' }).click();
  await expect(sidePanel.getByRole('button', { name: 'Pause' })).toBeVisible();

  await focus.getByRole('button', { name: 'Pause' }).click();
  await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible();
  await focus.getByRole('button', { name: 'Resume' }).click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  await focus.getByRole('button', { name: 'Stop' }).click();
  await expectViewportCentered(
    focus.getByRole('dialog', { name: 'Stop this session?' }),
  );
  await focus.getByRole('button', { name: 'Stop session' }).click();
  await expect(focus.getByText('Session stopped')).toBeVisible();
});

test('completes a Workflow with a local environment and Reward Dice', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'reward-background.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await expect(
    options.getByRole('listitem', {
      name: 'Image: reward-background.png',
    }),
  ).toBeVisible();

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Rewarded focus');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByRole('button', { name: 'Add phase' }).click();
  await options.getByLabel('Phase 2 type').selectOption('break');
  await options.getByLabel('Phase 2 duration in minutes').fill('0.5');
  await options.getByLabel('Background image').first().selectOption({
    label: 'reward-background.png',
  });
  await options.getByLabel('Enable Reward Dice').check();
  await options.getByLabel('Available rerolls').selectOption('1');
  await options.getByLabel('Reward side 1 icon').fill('☕');
  await options.getByLabel('Reward side 1 title').fill('Tea');
  await options.getByLabel('Reward side 2 icon').fill('🧘');
  await options.getByLabel('Reward side 2 title').fill('Stretch');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(
    options.getByRole('button', { name: 'Open Rewarded focus' }),
  ).toBeVisible();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await focus.getByRole('button', { name: 'Start Rewarded focus' }).click();
  await expect(
    focus.getByRole('heading', { name: 'Rewarded focus' }),
  ).toBeVisible();
  await expect(focus.locator('.focus-environment img')).toHaveAttribute(
    'src',
    /^blob:/u,
  );
  await expect
    .poll(() =>
      focus
        .getByRole('button', { name: 'Open side panel' })
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe('rgba(0, 0, 0, 0)');

  await expireActiveSessionDeadline(focus);

  await expect(focus.getByText('Transitioning to the next phase…')).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  await expect(focus.locator('.active-session')).toHaveAttribute(
    'data-transitioning',
    'true',
  );

  await expireActiveSessionDeadline(focus);

  const reward = focus.getByRole('dialog', { name: 'Reward unlocked' });
  await expect(reward).toBeVisible({ timeout: 15_000 });
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await expect(
    sidePanel.getByText('Reward pending — open focus view'),
  ).toBeVisible();
  await expect(sidePanel.getByRole('button', { name: 'Resume' })).toHaveCount(
    0,
  );
  await expectViewportCentered(reward);
  await expect(reward).toHaveClass(/dialog--reward/u);
  const coversTimerCard = await reward.evaluate((dialog) => {
    const dialogBounds = dialog.getBoundingClientRect();
    const timerCard = document.querySelector('.focus-app__content');
    if (timerCard === null) return false;
    const timerBounds = timerCard.getBoundingClientRect();
    return (
      dialogBounds.left <= timerBounds.left &&
      dialogBounds.right >= timerBounds.right &&
      dialogBounds.top <= timerBounds.top &&
      dialogBounds.bottom >= timerBounds.bottom
    );
  });
  expect(coversTimerCard).toBe(true);
  await expect(focus.getByTestId('reward-cube')).toHaveAttribute(
    'data-state',
    'ready',
  );
  await focus.getByRole('button', { name: 'Roll dice' }).click();
  await expect(focus.getByTestId('reward-cube')).toHaveAttribute(
    'data-state',
    'mixing',
  );
  await expect(reward).toContainText(/Tea|Stretch/u);
  await focus.getByRole('button', { name: 'Roll again · 1 left' }).click();
  await expect(focus.getByTestId('reward-cube')).toHaveAttribute(
    'data-state',
    'mixing',
  );
  await expect(reward).toContainText(/Tea|Stretch/u);
  await expect(focus.getByRole('button', { name: /Roll again/u })).toHaveCount(
    0,
  );
  await focus.getByRole('button', { name: 'Continue' }).click();
  await expect(focus.getByText('Break · Phase 2 of 2')).toBeVisible();
  await expect(focus.getByLabel('Time remaining')).toHaveText(/00:(29|30)/u);
});
