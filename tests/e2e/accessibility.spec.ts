import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import {
  expect,
  expireActiveSessionDeadline,
  openNewWorkflow,
  test,
} from './extensionFixture';

function overlapArea(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): number {
  const width = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  );
  const height = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  );
  return width * height;
}

async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test('user-facing extension surfaces have no detectable axe violations', async ({
  context,
  extensionUrls,
}) => {
  for (const url of [
    extensionUrls.options,
    extensionUrls.sidePanel,
    extensionUrls.focus,
  ]) {
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole('main').waitFor();
    await expectNoAccessibilityViolations(page);
    await page.close();
  }
});

test('Focus and Side Panel stay operable without horizontal overflow', async ({
  context,
  extensionUrls,
}) => {
  const focus = await context.newPage();
  await focus.setViewportSize({ width: 640, height: 720 });
  await focus.goto(extensionUrls.focus);
  await focus.getByRole('main').waitFor();
  await expect(focus.getByRole('banner')).toBeVisible();
  await expect(
    focus.getByRole('navigation', { name: 'Focus controls' }),
  ).toBeVisible();
  expect(
    await focus.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const sidePanel = await context.newPage();
  await sidePanel.setViewportSize({ width: 360, height: 720 });
  await sidePanel.goto(extensionUrls.sidePanel);
  await sidePanel.getByRole('main').waitFor();
  expect(
    await sidePanel.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expectNoAccessibilityViolations(focus);
  await expectNoAccessibilityViolations(sidePanel);
});

test('active Focus keeps header utilities clear of timer content at effective 200% width', async ({
  context,
  extensionUrls,
}) => {
  const focus = await context.newPage();
  await focus.setViewportSize({ width: 640, height: 720 });
  await focus.goto(extensionUrls.focus);
  await focus
    .getByRole('button', { name: /Start workflow:/u })
    .first()
    .click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  const header = await focus.locator('.focus-header').boundingBox();
  const utilities = await focus
    .getByRole('navigation', { name: 'Focus controls' })
    .boundingBox();
  const timer = await focus.locator('.focus-app__content').boundingBox();
  const timerContent = await focus.locator('.active-session').boundingBox();
  expect(header).not.toBeNull();
  expect(utilities).not.toBeNull();
  expect(timer).not.toBeNull();
  expect(timerContent).not.toBeNull();
  if (
    header !== null &&
    utilities !== null &&
    timer !== null &&
    timerContent !== null
  ) {
    expect(overlapArea(header, timer)).toBe(0);
    expect(overlapArea(utilities, timerContent)).toBe(0);
    expect(timerContent.y).toBeGreaterThanOrEqual(timer.y);
    expect(timerContent.y + timerContent.height).toBeLessThanOrEqual(
      timer.y + timer.height,
    );
  }
  for (const name of [
    'Pause',
    'Restart phase',
    'Restart workflow',
    'Skip phase',
    'Stop',
  ]) {
    const control = focus.getByRole('button', { name });
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds !== null) {
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(720);
    }
  }
});

test('real Focus and Side Panel Session states have no detectable axe violations', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await openNewWorkflow(options);
  await options.getByRole('button', { name: 'Detailed setup' }).click();
  await options.getByLabel('Workflow name').fill('Accessible reward journey');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByRole('tab', { name: 'Reward Dice' }).click();
  await options.getByLabel('Enable Reward Dice').check();
  for (const side of [1, 2]) {
    await options
      .getByRole('button', {
        name: new RegExp(`Select reward side ${String(side)}`, 'u'),
      })
      .click();
    await options.getByLabel(`Reward side ${String(side)} icon`).fill('★');
    await options
      .getByLabel(`Reward side ${String(side)} title`)
      .fill(`Reward ${String(side)}`);
    await options
      .getByLabel(`Enable Bonus Phase for side ${String(side)}`)
      .check();
    await options
      .getByLabel(`Side ${String(side)} Bonus Phase name`)
      .fill('Accessible Bonus');
    await options
      .getByLabel(`Side ${String(side)} Bonus Phase duration in minutes`)
      .fill('0.5');
  }
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options.getByRole('button', { name: 'Back to workflows' }).click();

  const focus = await context.newPage();
  const sidePanel = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await sidePanel.goto(extensionUrls.sidePanel);
  await expectNoAccessibilityViolations(focus);
  await expectNoAccessibilityViolations(sidePanel);

  await focus
    .getByRole('button', { name: 'Start workflow: Accessible reward journey' })
    .click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await focus.getByRole('button', { name: 'Pause' }).click();
  const pausedSession = focus.locator('.active-session');
  await expect(pausedSession).toHaveAttribute('data-session-state', 'paused');
  await expect(pausedSession.locator('.session-countdown')).toHaveCSS(
    'color',
    'rgb(47, 123, 92)',
  );
  await focus.getByRole('button', { name: 'Resume' }).click();
  await expect(pausedSession).toHaveAttribute('data-session-state', 'running');
  await sidePanel.reload();
  await expect(sidePanel.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expectNoAccessibilityViolations(focus);
  await expectNoAccessibilityViolations(sidePanel);
  await sidePanel.getByRole('button', { name: 'Back to workflows' }).click();
  await expect(
    sidePanel.getByRole('region', { name: 'Active session summary' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(sidePanel);
  await sidePanel.getByRole('button', { name: 'Return to session' }).click();
  await expect(sidePanel.getByRole('button', { name: 'Pause' })).toBeVisible();

  await expireActiveSessionDeadline(focus);
  await expect(focus.getByText('Transitioning to the next phase…')).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  await expireActiveSessionDeadline(focus);
  const reward = focus.getByRole('dialog', { name: 'Reward unlocked' });
  await expect(reward).toBeVisible({ timeout: 15_000 });
  await expectNoAccessibilityViolations(focus);

  await reward.getByRole('button', { name: 'Roll dice' }).click();
  await focus.getByTestId('reward-dice-video').dispatchEvent('error');
  await reward.getByRole('button', { name: 'Continue' }).click();
  await expect(focus.getByText('Bonus · Accessible Bonus')).toBeVisible();
  const bonusSession = focus.locator('.active-session');
  await expect(bonusSession).toHaveAttribute('data-session-segment', 'bonus');
  await expect(bonusSession.locator('.session-phase')).toHaveCSS(
    'color',
    'rgb(129, 77, 15)',
  );
  await expect(sidePanel.getByText('Bonus · Accessible Bonus')).toBeVisible();
  await expectNoAccessibilityViolations(focus);
  await expectNoAccessibilityViolations(sidePanel);

  await expireActiveSessionDeadline(focus);
  await expect(focus.getByText('Session complete')).toBeVisible({
    timeout: 15_000,
  });
  await expectNoAccessibilityViolations(focus);
  await expectNoAccessibilityViolations(sidePanel);
});

test('configuration tabs support keyboard-only navigation', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  const workflows = options.getByRole('tab', { name: 'Workflows' });
  await workflows.focus();

  await expect(
    options.getByRole('tablist', { name: 'Configuration' }),
  ).toHaveAttribute('aria-orientation', 'vertical');
  await options.keyboard.press('ArrowDown');
  await expect(options.getByRole('tab', { name: 'Assets' })).toBeFocused();
  await expect(options.getByRole('tab', { name: 'Assets' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await options.keyboard.press('End');
  await expect(options.getByRole('tab', { name: 'Settings' })).toBeFocused();
  await options.keyboard.press('Home');
  await expect(workflows).toBeFocused();
});

test('Workflow Studio shell is responsive without horizontal overflow', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.setViewportSize({ width: 1280, height: 800 });
  await options.goto(extensionUrls.options);
  const shellBody = options.locator('.workflow-studio-shell__body');
  const topBar = options.locator('.workflow-studio-shell__top-bar');
  const sidebar = options.locator('.workflow-studio-shell__sidebar');
  const tablist = options.getByRole('tablist', { name: 'Configuration' });
  const workflowTab = options.getByRole('tab', { name: 'Workflows' });
  const assetsTab = options.getByRole('tab', { name: 'Assets' });
  await expect(shellBody).toBeVisible();

  expect(
    await shellBody.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(2);
  await expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
  expect(
    await tablist.evaluate(
      (element) => getComputedStyle(element).flexDirection,
    ),
  ).toBe('column');
  expect(
    await tablist.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const wideBounds = await Promise.all([
    sidebar.boundingBox(),
    workflowTab.boundingBox(),
    assetsTab.boundingBox(),
  ]);
  const [wideSidebar, wideWorkflow, wideAssets] = wideBounds;
  expect(wideSidebar).not.toBeNull();
  expect(wideWorkflow).not.toBeNull();
  expect(wideAssets).not.toBeNull();
  if (wideSidebar !== null && wideWorkflow !== null && wideAssets !== null) {
    expect(wideWorkflow.x).toBe(wideAssets.x);
    expect(wideAssets.y).toBeGreaterThan(wideWorkflow.y);
    expect(wideWorkflow.x + wideWorkflow.width).toBeLessThanOrEqual(
      wideSidebar.x + wideSidebar.width,
    );
  }
  expect(
    await topBar.evaluate((element) => ({
      alignItems: getComputedStyle(element).alignItems,
      marginBottom: getComputedStyle(element).marginBottom,
    })),
  ).toEqual({ alignItems: 'center', marginBottom: '0px' });
  expect(
    await options.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await options.setViewportSize({ width: 500, height: 800 });
  const topBarIdentity = topBar.locator(':scope > .app-header__identity');
  const topBarButton = topBar.locator(':scope > .button');
  expect(
    await shellBody.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(1);
  await expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
  expect(
    await tablist.evaluate((element) => ({
      clientWidth: element.clientWidth,
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      scrollWidth: element.scrollWidth,
    })),
  ).toMatchObject({ columns: 3 });
  expect(
    await tablist.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const narrowWorkflow = await workflowTab.boundingBox();
  const narrowAssets = await assetsTab.boundingBox();
  expect(narrowWorkflow).not.toBeNull();
  expect(narrowAssets).not.toBeNull();
  if (narrowWorkflow !== null && narrowAssets !== null) {
    expect(narrowAssets.x).toBeGreaterThan(narrowWorkflow.x);
    expect(narrowAssets.y).toBe(narrowWorkflow.y);
  }
  expect(
    await topBar.evaluate((element) => ({
      alignItems: getComputedStyle(element).alignItems,
      flexDirection: getComputedStyle(element).flexDirection,
    })),
  ).toEqual({ alignItems: 'stretch', flexDirection: 'column' });
  const [identityBounds, buttonBounds, topBarBounds] = await Promise.all([
    topBarIdentity.boundingBox(),
    topBarButton.boundingBox(),
    topBar.boundingBox(),
  ]);
  expect(identityBounds).not.toBeNull();
  expect(buttonBounds).not.toBeNull();
  expect(topBarBounds).not.toBeNull();
  if (
    identityBounds !== null &&
    buttonBounds !== null &&
    topBarBounds !== null
  ) {
    expect(buttonBounds.y).toBeGreaterThanOrEqual(
      identityBounds.y + identityBounds.height,
    );
    expect(buttonBounds.width).toBeCloseTo(
      topBarBounds.width - 2 * (buttonBounds.x - topBarBounds.x),
      0,
    );
    expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(
      topBarBounds.x + topBarBounds.width,
    );
  }
  await workflowTab.focus();
  await options.keyboard.press('ArrowRight');
  await expect(assetsTab).toBeFocused();
  expect(
    await options.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  // A 640 CSS-pixel viewport represents a 1280-pixel window at 200% zoom.
  await options.setViewportSize({ width: 640, height: 450 });
  expect(
    await shellBody.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(1);
  expect(
    await options.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('Detailed Studio preview and phase sequence stay usable across supported widths', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.setViewportSize({ width: 1280, height: 800 });
  await options.goto(extensionUrls.options);

  await options.getByRole('button', { name: 'Back to workflows' }).click();
  await options.getByRole('button', { name: 'Open Balanced Flow' }).click();

  const sequence = options.getByRole('list', { name: 'Phase sequence' });
  const firstPreview = options.getByRole('region', {
    name: 'Settle in preview',
  });
  const firstPhase = options.getByRole('button', {
    name: 'Select Phase 1: Settle in',
  });
  const secondPhase = options.getByRole('button', {
    name: 'Select Phase 2: Short break',
  });

  await expect(sequence).toBeVisible();
  await expect(firstPreview).toContainText('Settle in');
  await firstPhase.focus();
  await options.keyboard.press('ArrowRight');
  await expect(secondPhase).toBeFocused();
  await expect(secondPhase).toHaveAttribute('aria-pressed', 'true');
  const preview = options.getByRole('region', {
    name: 'Short break preview',
  });
  await expect(preview).toContainText('Short break');

  for (const width of [500, 640]) {
    await options.setViewportSize({ width, height: 800 });
    await expect(preview).toBeVisible();
    expect(
      await options.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      await sequence.evaluate(
        (element) => element.scrollWidth >= element.clientWidth,
      ),
    ).toBe(true);
  }

  await options.setViewportSize({ width: 1280, height: 800 });
  await options.getByRole('tab', { name: 'Reward Dice' }).click();
  const rewardEnabled = options.getByLabel('Enable Reward Dice');
  if (!(await rewardEnabled.isChecked())) await rewardEnabled.check();
  const rewardLayout = options.locator('.reward-editor__side-layout');
  const firstSide = options.getByRole('button', {
    name: /Select reward side 1/,
  });
  const secondSide = options.getByRole('button', {
    name: /Select reward side 2/,
  });
  await expect(rewardLayout).toBeVisible();
  expect(
    await rewardLayout.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(2);
  await firstSide.focus();
  await options.keyboard.press('ArrowDown');
  await expect(secondSide).toBeFocused();
  await expect(secondSide).toHaveAttribute('aria-pressed', 'true');

  await options.setViewportSize({ width: 500, height: 800 });
  expect(
    await rewardLayout.evaluate(
      (element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(1);
  expect(
    await options.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('Asset Role dialog has no detectable axe violations', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'role-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const trigger = options.getByRole('button', {
    name: 'Manage role for role-image.png',
  });
  await trigger.click();
  await expect(options.getByRole('textbox', { name: 'Role' })).toBeFocused();
  await expectNoAccessibilityViolations(options);
  await options.getByRole('textbox', { name: 'Role' }).fill('Backdrop');
  await options.getByRole('button', { name: 'Review role' }).click();
  await options.getByRole('button', { name: 'Assign role' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: role-image.png' }),
  ).toContainText('Role: Backdrop');
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Back to workflows' }).click();
  await options.getByRole('button', { name: 'New workflow' }).click();
  await options.getByRole('button', { name: 'Detailed setup' }).click();
  await expect(
    options.getByRole('option', { name: 'Backdrop — role-image.png' }),
  ).toHaveCount(1);
  await expectNoAccessibilityViolations(options);
});

test('Asset retirement dialog has no detectable axe violations', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'retire-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const trigger = options.getByRole('button', {
    name: 'Retire retire-image.png',
  });
  await trigger.click();
  await expect(options.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await expectNoAccessibilityViolations(options);
  await options.keyboard.press('Tab');
  await options.keyboard.press('Enter');
  await expect(options.getByRole('button', { name: 'Continue' })).toBeFocused();
  await options.keyboard.press('Enter');
  await expect(
    options.getByRole('radio', { name: 'Use an existing Asset' }),
  ).toBeFocused();
  await expectNoAccessibilityViolations(options);
  await options.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('local extension documents become interactive within 500 ms', async ({
  context,
  extensionUrls,
}) => {
  for (const url of [
    extensionUrls.options,
    extensionUrls.sidePanel,
    extensionUrls.focus,
  ]) {
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole('main').waitFor();
    const interactiveMilliseconds = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;
      return navigation?.domInteractive ?? Number.POSITIVE_INFINITY;
    });
    expect(interactiveMilliseconds).toBeLessThan(500);
    await page.close();
  }
});

test('generated manifest contains only approved permissions and no hosts', async () => {
  const manifestPath = resolve(
    import.meta.dirname,
    '../../.output/chrome-mv3/manifest.json',
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<
    string,
    unknown
  >;
  expect(manifest['name']).toBe('Locusora');
  expect(manifest['short_name']).toBe('Locusora');
  expect(manifest['minimum_chrome_version']).toBe('142');
  expect(manifest['permissions']).toEqual([
    'sidePanel',
    'storage',
    'alarms',
    'tabs',
  ]);
  expect(manifest['action']).toEqual({
    default_title: 'Open Locusora focus view',
    default_icon: {
      16: 'brand/icon-16.png',
      32: 'brand/icon-32.png',
      48: 'brand/icon-48.png',
    },
  });
  expect(manifest['icons']).toEqual({
    16: 'brand/icon-16.png',
    32: 'brand/icon-32.png',
    48: 'brand/icon-48.png',
    128: 'brand/icon-128.png',
  });
  expect(manifest['host_permissions']).toBeUndefined();
  expect(manifest['content_scripts']).toBeUndefined();
});
