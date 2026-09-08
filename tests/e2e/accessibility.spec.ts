import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from './extensionFixture';

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

test('configuration tabs support keyboard-only navigation', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  const workflows = options.getByRole('tab', { name: 'Workflows' });
  await workflows.focus();

  await options.keyboard.press('ArrowRight');
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
  await trigger.focus();
  await options.keyboard.press('Enter');
  await expect(options.getByRole('textbox', { name: 'Role' })).toBeFocused();
  await expectNoAccessibilityViolations(options);
  await options.getByRole('textbox', { name: 'Role' }).fill('Backdrop');
  await options.getByRole('button', { name: 'Review role' }).click();
  await options.getByRole('button', { name: 'Assign role' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: role-image.png' }),
  ).toContainText('Role: Backdrop');
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await expect(
    options.getByRole('option', { name: 'Backdrop — role-image.png' }),
  ).toHaveCount(1);
  await expectNoAccessibilityViolations(options);
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
