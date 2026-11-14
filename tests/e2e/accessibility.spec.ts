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

test('Side Panel compact chooser stays bounded across supported widths', async ({
  context,
  extensionUrls,
}) => {
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);

  for (const viewport of [
    { width: 640, height: 900 },
    { width: 420, height: 900 },
    { width: 320, height: 900 },
    { width: 210, height: 450 },
  ]) {
    await sidePanel.setViewportSize(viewport);
    const chooser = sidePanel.locator('.side-panel-workflow-chooser');
    await expect(chooser).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: /Start workflow:/u }).first(),
    ).toBeVisible();
    await expect(
      sidePanel.getByRole('button', { name: /Create|Move|Duplicate|Delete/u }),
    ).toHaveCount(0);
    expect(
      await sidePanel.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);

    const open = sidePanel.getByRole('button', { name: /Open .+/u }).first();
    const start = sidePanel
      .getByRole('button', { name: /Start workflow:/u })
      .first();
    for (const control of [open, start]) {
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      if (bounds !== null) {
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      }
    }
    if (viewport.width === 210) {
      const openBounds = await open.boundingBox();
      const startBounds = await start.boundingBox();
      expect(openBounds).not.toBeNull();
      expect(startBounds).not.toBeNull();
      if (openBounds !== null && startBounds !== null) {
        expect(openBounds.width).toBeGreaterThan(100);
        expect(startBounds.y).toBeGreaterThanOrEqual(
          openBounds.y + openBounds.height,
        );
      }
    }
  }

  await expectNoAccessibilityViolations(sidePanel);
});

test('Side Panel empty chooser keeps Studio navigation operable across supported widths', async ({
  context,
  extensionUrls,
}) => {
  const sidePanel = await context.newPage();
  await sidePanel.goto(extensionUrls.sidePanel);
  await expect(
    sidePanel.getByRole('button', { name: 'Start workflow: Quick Focus' }),
  ).toBeVisible();
  await sidePanel.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('locusora');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Unable to open the test database.'));
      };
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('workflows', 'readwrite');
      transaction.objectStore('workflows').clear();
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(
          transaction.error ?? new Error('Unable to clear test Workflows.'),
        );
      };
      transaction.onabort = () => {
        reject(
          transaction.error ?? new Error('Clearing test Workflows aborted.'),
        );
      };
    });
    database.close();
  });
  await sidePanel.reload();

  for (const viewport of [
    { width: 420, height: 900 },
    { width: 320, height: 900 },
    { width: 210, height: 450 },
  ]) {
    await sidePanel.setViewportSize(viewport);
    await expect(
      sidePanel.getByRole('heading', {
        name: 'Build your first focus rhythm.',
      }),
    ).toBeVisible();
    const openStudio = sidePanel.getByRole('button', {
      name: 'Open Workflow Studio',
    });
    await expect(openStudio).toBeVisible();
    const bounds = await openStudio.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds !== null) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    }
    expect(
      await sidePanel.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }

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

test('active Focus reflows utilities and session controls at the approved effective 200% viewport', async ({
  context,
  extensionUrls,
}) => {
  const focus = await context.newPage();
  await focus.setViewportSize({ width: 756, height: 493 });
  await focus.goto(extensionUrls.focus);
  await focus
    .getByRole('button', { name: /Start workflow:/u })
    .first()
    .click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  const header = await focus.locator('.focus-header').boundingBox();
  const timer = await focus.locator('.focus-app__content').boundingBox();
  const countdown = await focus.locator('.session-countdown').boundingBox();
  expect(header).not.toBeNull();
  expect(timer).not.toBeNull();
  expect(countdown).not.toBeNull();
  if (header !== null && timer !== null && countdown !== null) {
    expect(overlapArea(header, timer)).toBe(0);
    expect(countdown.y).toBeGreaterThanOrEqual(timer.y);
    expect(countdown.y + countdown.height).toBeLessThanOrEqual(
      timer.y + timer.height,
    );
  }
  expect(
    await focus.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(focus.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expectNoAccessibilityViolations(focus);
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
    'rgb(155, 224, 188)',
  );
  await focus.getByRole('button', { name: 'Resume' }).click();
  await expect(pausedSession).toHaveAttribute('data-session-state', 'running');
  await sidePanel.reload();
  await expect(sidePanel.getByRole('button', { name: 'Pause' })).toBeVisible();
  for (const viewport of [
    { width: 420, height: 900 },
    { width: 320, height: 900 },
    { width: 210, height: 450 },
  ]) {
    await sidePanel.setViewportSize(viewport);
    await expect(
      sidePanel.getByRole('button', { name: 'Pause' }),
    ).toBeVisible();
    expect(
      await sidePanel.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
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
  await expect(
    focus.getByRole('heading', { name: 'Accessible Bonus' }),
  ).toBeVisible();
  const bonusSession = focus.locator('.active-session');
  await expect(bonusSession).toHaveAttribute('data-session-segment', 'bonus');
  await expect(bonusSession.locator('.session-phase')).toHaveCSS(
    'color',
    'rgb(255, 210, 150)',
  );
  await expect(
    sidePanel.getByRole('heading', { name: 'Accessible Bonus' }),
  ).toBeVisible();
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
  const shellBody = options.locator('.workflow-studio-shell');
  const topBar = options.locator('.workflow-studio-shell__top-bar');
  const sidebar = options.locator('.workflow-studio-shell__sidebar');
  const tablist = options.getByRole('tablist', { name: 'Configuration' });
  const workflowTab = options.getByRole('tab', { name: 'Workflows' });
  const assetsTab = options.getByRole('tab', { name: 'Assets' });
  await expect(shellBody).toBeVisible();
  await expect(options.getByRole('heading', { level: 1 })).toHaveCount(1);

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
  const topBarIdentity = topBar.locator(
    ':scope > .workflow-studio-shell__context',
  );
  const topBarButton = topBar.locator(
    ':scope > .workflow-studio-shell__top-bar-controls > .button',
  );
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
    name: /^Select Phase 1: Settle in ·/u,
  });
  const secondPhase = options.getByRole('button', {
    name: /^Select Phase 2: Short break ·/u,
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

  await options.setViewportSize({ width: 1440, height: 1024 });
  const basicCard = options.getByRole('region', { name: 'Basic' });
  const environmentCard = options.getByRole('region', { name: 'Environment' });
  const [basicBounds, environmentBounds] = await Promise.all([
    basicCard.boundingBox(),
    environmentCard.boundingBox(),
  ]);
  expect(basicBounds).not.toBeNull();
  expect(environmentBounds).not.toBeNull();
  if (basicBounds !== null && environmentBounds !== null) {
    expect(basicBounds.y + basicBounds.height).toBeLessThanOrEqual(1024);
    expect(environmentBounds.y + environmentBounds.height).toBeLessThanOrEqual(
      1024,
    );
  }

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

test('Quick Reward drawer anchors its footer and scrolls long side lists', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.setViewportSize({ width: 1280, height: 800 });
  await options.goto(extensionUrls.options);
  await options.getByRole('button', { name: 'Back to workflows' }).click();
  await options.getByRole('button', { name: 'New workflow' }).click();
  await options.getByRole('button', { name: 'Quick setup' }).click();
  await options.getByLabel('Use Reward Dice').check();
  await options.getByRole('button', { name: 'Configure sides' }).click();

  const drawer = options.getByRole('dialog', { name: 'Reward sides drawer' });
  const sides = drawer.locator('.quick-reward-drawer__sides');
  const footer = drawer.locator('.quick-reward-drawer__footer');
  const shortGeometry = await drawer.evaluate((element) => {
    const footerElement = element.querySelector<HTMLElement>(
      '.quick-reward-drawer__footer',
    );
    return {
      drawerBottom: element.getBoundingClientRect().bottom,
      footerBottom: footerElement?.getBoundingClientRect().bottom ?? 0,
    };
  });
  expect(shortGeometry.drawerBottom - shortGeometry.footerBottom).toBeLessThan(
    32,
  );

  for (let index = 0; index < 8; index += 1) {
    await footer
      .getByRole('button', { name: 'Add side' })
      .evaluate((button) => {
        (button as HTMLButtonElement).click();
      });
  }
  await expect(drawer.getByLabel('Reward side 10 title')).toBeAttached();
  expect(
    await sides.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await expect(footer).toBeVisible();
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
  const backToWorkflows = options.getByRole('button', {
    name: 'Back to workflows',
  });
  if (await backToWorkflows.isVisible()) await backToWorkflows.click();
  await expect(
    options.getByRole('button', { name: 'New workflow' }),
  ).toBeVisible();
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
