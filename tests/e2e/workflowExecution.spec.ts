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
  await expect(options).toHaveTitle('Locusora settings');
  await expect(
    options.getByRole('heading', { name: 'Locusora' }),
  ).toBeVisible();

  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await expect(sidePanel).toHaveTitle('Locusora');
  await expect(
    sidePanel.getByRole('heading', { name: 'Locusora' }),
  ).toBeVisible();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await expect(focus).toHaveTitle('Locusora focus');
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
    options.getByRole('heading', { name: 'Locusora' }),
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

test('persists a six-phase custom Reward schedule by phase marker', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'bonus-background.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'bonus-ambient.mp3',
    mimeType: 'audio/mpeg',
    buffer: Buffer.from('ID3 bonus audio fixture'),
  });
  await options
    .getByRole('button', { name: 'Manage role for bonus-ambient.mp3' })
    .click();
  await options.getByRole('textbox', { name: 'Role' }).fill('Bonus ambience');
  await options.getByRole('button', { name: 'Review role' }).click();
  await options.getByRole('button', { name: 'Assign role' }).click();
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Custom rewards');
  for (let index = 0; index < 5; index += 1) {
    await options.getByRole('button', { name: 'Add phase' }).click();
  }
  await options.getByLabel('Enable Reward Dice').check();
  await options.getByLabel('Reward side 1 icon').fill('☕');
  await options.getByLabel('Reward side 1 title').fill('Tea');
  await options.getByLabel('Reward side 1 availability').selectOption('early');
  await options.getByLabel('Reward side 2 icon').fill('🌿');
  await options.getByLabel('Reward side 2 title').fill('Fresh air');
  await options.getByLabel('Reward side 2 availability').selectOption('late');
  await options.getByLabel('Enable Bonus Phase for side 1').check();
  await options.getByLabel('Side 1 Bonus Phase name').fill('Tea break');
  await options
    .getByLabel('Side 1 Bonus Phase duration in minutes')
    .fill('7.5');
  await options
    .getByLabel('Side 1 Bonus Phase background color')
    .fill('#123456');
  await options
    .getByLabel('Side 1 Bonus Phase background image')
    .selectOption({ label: 'bonus-background.png' });
  await options
    .getByLabel('Side 1 Bonus Phase ambient audio')
    .selectOption('role:bonus ambience');

  await options.getByLabel('Reward after Phase 1').uncheck();
  await options.getByLabel('Reward after Phase 5').uncheck();
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(options.getByRole('status')).toHaveText('Workflow saved');

  await options.reload();
  await options.getByRole('button', { name: 'Open Custom rewards' }).click();
  await expect(options.getByLabel('Reward schedule')).toHaveValue('custom');
  await expect(options.getByLabel('Reward side 1 availability')).toHaveValue(
    'early',
  );
  await expect(options.getByLabel('Reward side 2 availability')).toHaveValue(
    'late',
  );
  await expect(
    options.getByLabel('Enable Bonus Phase for side 1'),
  ).toBeChecked();
  await expect(options.getByLabel('Side 1 Bonus Phase name')).toHaveValue(
    'Tea break',
  );
  await expect(
    options.getByLabel('Side 1 Bonus Phase duration in minutes'),
  ).toHaveValue('7.5');
  await expect(
    options.getByLabel('Side 1 Bonus Phase background color'),
  ).toHaveValue('#123456');
  await expect(
    options.getByLabel('Side 1 Bonus Phase background image'),
  ).toHaveValue(/^direct:/u);
  await expect(
    options.getByLabel('Side 1 Bonus Phase ambient audio'),
  ).toHaveValue('role:bonus ambience');
  for (const index of [1, 2, 3, 5]) {
    await expect(
      options.getByLabel(`Reward after Phase ${String(index + 1)}`),
    ).toBeChecked();
  }
  for (const index of [0, 4]) {
    await expect(
      options.getByLabel(`Reward after Phase ${String(index + 1)}`),
    ).not.toBeChecked();
  }
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
  await expect(sidePanel.getByText('Reward pending')).toBeVisible();
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
  const persistedResult = await reward
    .locator('.reward-result h3')
    .textContent();
  expect(persistedResult).not.toBeNull();
  await focus.reload();
  await expect(
    focus.getByRole('dialog', { name: 'Reward unlocked' }),
  ).toContainText(persistedResult ?? '');
  await expect(
    focus.getByRole('button', { name: 'Roll again · 1 left' }),
  ).toBeVisible();
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

test('executes and restores a non-final Bonus Reward Phase authoritatively', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Bonus Reward journey');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByRole('button', { name: 'Add phase' }).click();
  await options.getByLabel('Phase 2 type').selectOption('break');
  await options.getByLabel('Phase 2 duration in minutes').fill('0.5');
  await options.getByLabel('Enable Reward Dice').check();
  for (const side of [1, 2]) {
    await options.getByLabel(`Reward side ${String(side)} icon`).fill('✨');
    await options
      .getByLabel(`Reward side ${String(side)} title`)
      .fill(`Bonus ${String(side)}`);
    await options
      .getByLabel(`Enable Bonus Phase for side ${String(side)}`)
      .check();
    await options
      .getByLabel(`Side ${String(side)} Bonus Phase name`)
      .fill('Bonus reset');
    await options
      .getByLabel(`Side ${String(side)} Bonus Phase duration in minutes`)
      .fill('0.5');
    await options
      .getByLabel(`Side ${String(side)} Bonus Phase background color`)
      .fill('#123456');
  }
  await options.getByRole('button', { name: 'Save workflow' }).click();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await focus
    .getByRole('button', { name: 'Start Bonus Reward journey' })
    .click();
  await expireActiveSessionDeadline(focus);
  await expect(
    focus.getByText('Transitioning to the next phase…'),
  ).toBeVisible();
  await expireActiveSessionDeadline(focus);
  await expect(
    focus.getByRole('dialog', { name: 'Reward unlocked' }),
  ).toBeVisible();
  await focus.getByRole('button', { name: 'Roll dice' }).click();
  await focus.getByRole('button', { name: 'Continue' }).click();

  await expect(focus.getByText('Bonus · Bonus reset')).toBeVisible();
  await expect(focus.locator('.focus-environment')).toHaveCSS(
    'background-color',
    'rgb(18, 52, 86)',
  );
  await focus.reload();
  await expect(focus.getByText('Bonus · Bonus reset')).toBeVisible();
  await focus.getByRole('button', { name: 'Pause' }).click();
  await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible();
  await focus.getByRole('button', { name: 'Resume' }).click();
  await focus.getByRole('button', { name: 'Restart phase' }).click();
  await focus
    .getByRole('dialog', { name: 'Restart this Bonus Phase?' })
    .getByRole('button', { name: 'Restart phase' })
    .click();
  await expect(focus.getByLabel('Time remaining')).toHaveText(/00:(29|30)/u);

  await expireActiveSessionDeadline(focus);
  await expect(focus.getByText('Break · Phase 2 of 2')).toBeVisible();
  await expect(
    focus.getByRole('dialog', { name: 'Reward unlocked' }),
  ).toHaveCount(0);
});
