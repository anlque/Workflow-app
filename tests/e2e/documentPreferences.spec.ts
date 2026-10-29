import { expect, test } from './extensionFixture';

test('keeps all Focus semantic states invariant across document themes', async ({
  page,
  extensionUrls,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(extensionUrls.focus);
  await page.getByRole('main').waitFor();
  const setTheme = async (theme: 'light' | 'dark' | 'system') => {
    await page.evaluate(async (nextTheme) => {
      const extension = globalThis as typeof globalThis & {
        chrome: {
          storage: {
            local: {
              set(value: Record<string, unknown>): Promise<void>;
            };
          };
        };
      };
      await extension.chrome.storage.local.set({
        settings: {
          theme: nextTheme,
          reducedMotion: 'system',
        },
      });
    }, theme);
    await expect
      .poll(() =>
        page.locator('html').evaluate((root) => root.dataset['theme']),
      )
      .toBe(theme);
  };

  const readFocusState = async () => {
    await page.locator('.focus-app-surface').evaluate((surface) => {
      surface.querySelector('[data-testid="focus-theme-fixtures"]')?.remove();
      surface.insertAdjacentHTML(
        'beforeend',
        `<div data-testid="focus-theme-fixtures" style="position:fixed;left:-10000px;top:0;pointer-events:none">
          <div class="active-session" data-session-segment="bonus">
            <p class="session-phase" data-testid="focus-bonus">Bonus</p>
          </div>
          <div class="dialog dialog--reward" data-testid="focus-reward">Reward</div>
          <p class="feedback feedback--error" data-testid="focus-danger">Danger</p>
        </div>`,
      );
    });
    const primary = page.locator('.focus-app-surface .button--primary').first();
    await primary.waitFor();
    await page.mouse.move(500, 500);
    await primary.evaluate((element: HTMLButtonElement) => {
      element.blur();
    });
    await expect
      .poll(() =>
        primary.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe('rgb(47, 123, 92)');
    const defaultButton = await primary.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    await primary.hover();
    await expect
      .poll(() =>
        primary.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .toBe('rgb(59, 137, 104)');
    const hoverBackground = await primary.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await primary.focus();
    const focusOutline = await primary.evaluate(
      (element) => getComputedStyle(element).outlineColor,
    );
    const stateStyles = await page
      .locator('.focus-app-surface')
      .evaluate((surface) => {
        const style = getComputedStyle(surface);
        const read = (selector: string) => {
          const element = surface.querySelector(selector);
          if (element === null) throw new Error(`Missing ${selector}`);
          const computed = getComputedStyle(element);
          return {
            background: computed.backgroundColor,
            border: computed.borderColor,
            color: computed.color,
          };
        };
        return {
          colorScheme: style.colorScheme,
          tokens: [
            '--color-primary',
            '--color-primary-hover',
            '--color-primary-active',
            '--color-primary-soft',
            '--color-accent-soft',
            '--color-focus-ring',
            '--color-reward-surface',
            '--color-reward-foreground',
            '--color-danger-surface',
            '--color-danger-foreground',
            '--color-border',
            '--color-control-border',
          ].map((token) => style.getPropertyValue(token).trim()),
          bonus: read('[data-testid="focus-bonus"]'),
          reward: read('[data-testid="focus-reward"]'),
          danger: read('[data-testid="focus-danger"]'),
        };
      });
    return { defaultButton, focusOutline, hoverBackground, stateStyles };
  };

  await setTheme('dark');
  const dark = await readFocusState();
  await setTheme('light');
  const light = await readFocusState();
  await setTheme('system');
  const system = await readFocusState();

  expect(light).toEqual(dark);
  expect(system).toEqual(dark);
  expect(dark.defaultButton).toEqual({
    background: 'rgb(47, 123, 92)',
    color: 'rgb(255, 255, 255)',
  });
  expect(dark.hoverBackground).toBe('rgb(59, 137, 104)');
  expect(dark.focusOutline).toBe('rgb(74, 122, 255)');
  expect(dark.stateStyles.bonus.color).toBe('rgb(129, 77, 15)');
  expect(dark.stateStyles.reward.background).toBe('rgb(245, 250, 247)');
  expect(dark.stateStyles.danger).toMatchObject({
    background: 'rgb(255, 244, 241)',
    color: 'rgb(132, 60, 48)',
  });
});

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

  await options.getByRole('button', { name: 'Back to workflows' }).click();
  await options.getByRole('button', { name: 'New workflow' }).click();
  await options.getByRole('button', { name: 'Detailed setup' }).click();
  await options.getByLabel('Workflow name').fill('Preference sync focus');
  await options.getByLabel('Phase 1 duration in minutes').fill('0.5');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(options.getByRole('status')).toHaveText('Workflow saved');
  await focus
    .getByRole('button', { name: 'Start workflow: Preference sync focus' })
    .click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(focus.getByLabel('Focus theme')).toHaveCount(0);
  const neutralFocusChrome = await focus
    .locator('.focus-app-surface')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        surface: style.getPropertyValue('--color-surface').trim(),
        ink: style.getPropertyValue('--color-ink').trim(),
      };
    });

  await focus.locator('.focus-app__content').click();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  const nativePause = focus.getByRole('button', { name: 'Pause' });
  await nativePause.focus();
  await focus.keyboard.press('Space');
  const nativeResume = focus.getByRole('button', { name: 'Resume' });
  await expect(nativeResume).toBeVisible();
  await nativeResume.focus();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  await focus.getByRole('button', { name: 'Open Workflow Studio' }).click();
  const studioOverlay = focus.locator('.workflow-studio-overlay');
  await expect(studioOverlay).toBeVisible();
  await studioOverlay.dispatchEvent('keydown', { code: 'Space', key: ' ' });
  await focus.getByRole('button', { name: 'Close Workflow Studio' }).click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await focus.getByRole('button', { name: 'Stop' }).click();
  const stopDialog = focus.getByRole('dialog');
  await expect(stopDialog).toBeVisible();
  await stopDialog.dispatchEvent('keydown', { code: 'Space', key: ' ' });
  await expect(stopDialog).toBeVisible();
  await stopDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();

  await options.getByRole('tab', { name: 'Settings' }).click();
  const pauseWithSpace = options.getByRole('checkbox', {
    name: 'Pause or resume with Space',
  });
  await pauseWithSpace.uncheck();
  await focus.locator('.focus-app__content').click();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await pauseWithSpace.check();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Resume' })).toBeVisible();
  await focus.keyboard.press('Space');
  await expect(focus.getByRole('button', { name: 'Pause' })).toBeVisible();
  await options.getByRole('combobox', { name: 'Theme' }).selectOption('light');
  await options
    .getByRole('combobox', { name: 'Reduced motion' })
    .selectOption('no-preference');
  await options.getByRole('slider', { name: 'Cue volume' }).fill('42');
  const backgroundBlur = options.getByRole('slider', {
    name: /Background blur/,
  });
  await backgroundBlur.fill('10');
  await backgroundBlur.press('Tab');
  await expect(options.getByLabel('Theme')).toBeEnabled();
  const backgroundBrightness = options.getByRole('slider', {
    name: /Background brightness/,
  });
  await backgroundBrightness.fill('120');
  await backgroundBrightness.press('Tab');
  await expect(options.getByLabel('Theme')).toBeEnabled();
  const muteMusic = options.getByRole('checkbox', { name: 'Mute music' });
  await muteMusic.click();
  await expect(muteMusic).toBeChecked();

  await expect(focus.getByRole('slider', { name: 'Cue volume' })).toHaveValue(
    '42',
  );
  await expect(
    focus.getByRole('button', { name: 'Unmute music' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(options.getByRole('slider', { name: 'Cue volume' })).toHaveValue(
    '42',
  );
  await focus.locator('summary').filter({ hasText: 'Appearance' }).click();
  await expect(focus.getByRole('slider', { name: /Focus blur/ })).toHaveValue(
    '10',
  );
  await expect(
    focus.getByRole('slider', { name: /Focus brightness/ }),
  ).toHaveValue('120');

  const focusBlur = focus.getByRole('slider', { name: /Focus blur/ });
  await focusBlur.fill('14');
  await focusBlur.press('Tab');
  const focusBrightness = focus.getByRole('slider', {
    name: /Focus brightness/,
  });
  await focusBrightness.fill('130');
  await focusBrightness.press('Tab');
  await expect(
    options.getByRole('slider', { name: /Background blur/ }),
  ).toHaveValue('14');
  await expect(
    options.getByRole('slider', { name: /Background brightness/ }),
  ).toHaveValue('130');

  await focus.getByRole('slider', { name: 'Music volume' }).fill('37');
  await focus.getByRole('button', { name: 'Mute cues' }).click();
  await expect(
    options.getByRole('slider', { name: 'Music volume' }),
  ).toHaveValue('37');
  await expect(
    options.getByRole('checkbox', { name: 'Mute cues', exact: true }),
  ).toBeChecked();

  for (const page of [options, focus, sidePanel]) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('html')).toHaveAttribute(
      'data-reduced-motion',
      'no-preference',
    );
  }
  expect(
    await focus.locator('.focus-app-surface').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        surface: style.getPropertyValue('--color-surface').trim(),
        ink: style.getPropertyValue('--color-ink').trim(),
      };
    }),
  ).toEqual(neutralFocusChrome);

  await expect
    .poll(() =>
      focus.evaluate(async () => {
        const extension = globalThis as typeof globalThis & {
          chrome: {
            storage: {
              local: {
                get(key: string): Promise<Record<string, unknown>>;
              };
            };
          };
        };
        return extension.chrome.storage.local.get('settings');
      }),
    )
    .toMatchObject({
      settings: {
        ambientMuted: true,
        ambientVolumePercent: 37,
        cueVolumePercent: 42,
        cuesMuted: true,
        muteCuesWithMusic: false,
        backgroundBlurPx: 14,
        backgroundBrightnessPercent: 130,
      },
    });

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
