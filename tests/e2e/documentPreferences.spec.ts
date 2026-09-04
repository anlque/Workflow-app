import { expect, test } from './extensionFixture';

test('loads before visibility and synchronizes preferences across open documents', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.evaluate(async () => {
    const extension = globalThis as typeof globalThis & {
      chrome: {
        storage: {
          local: { set(value: Record<string, unknown>): Promise<void> };
        };
      };
    };
    await extension.chrome.storage.local.set({
      settings: { theme: 'dark', reducedMotion: 'reduce' },
    });
  });

  const focus = await context.newPage();
  const sidePanel = await context.newPage();
  await Promise.all([
    focus.goto(extensionUrls.focus),
    sidePanel.goto(extensionUrls.sidePanel),
  ]);

  for (const page of [options, focus, sidePanel]) {
    await expect(page.locator('html')).toHaveAttribute(
      'data-preferences-ready',
      'true',
    );
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute(
      'data-reduced-motion',
      'reduce',
    );
    await expect(page.locator('body')).toBeVisible();
  }

  await options.getByRole('tab', { name: 'Settings' }).click();
  await options.getByRole('combobox', { name: 'Theme' }).selectOption('light');
  await options
    .getByRole('combobox', { name: 'Reduced motion' })
    .selectOption('no-preference');

  for (const page of [options, focus, sidePanel]) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute(
      'data-reduced-motion',
      'no-preference',
    );
  }

  const attributesBefore = await focus.locator('html').evaluate((root) => ({
    theme: root.dataset['theme'],
    motion: root.dataset['reducedMotion'],
  }));
  await options.evaluate(async () => {
    const extension = globalThis as typeof globalThis & {
      chrome: {
        storage: {
          local: { set(value: Record<string, unknown>): Promise<void> };
        };
      };
    };
    await extension.chrome.storage.local.set({ unrelated: 'ignored' });
  });
  expect(
    await focus.locator('html').evaluate((root) => ({
      theme: root.dataset['theme'],
      motion: root.dataset['reducedMotion'],
    })),
  ).toEqual(attributesBefore);
});

test('system reduced motion responds without reload', async ({
  page,
  extensionUrls,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(extensionUrls.focus);
  await page.evaluate(async () => {
    const extension = globalThis as typeof globalThis & {
      chrome: {
        storage: {
          local: { set(value: Record<string, unknown>): Promise<void> };
        };
      };
    };
    await extension.chrome.storage.local.set({
      settings: { theme: 'system', reducedMotion: 'system' },
    });
  });
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'no-preference',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute(
    'data-reduced-motion',
    'reduce',
  );
});
