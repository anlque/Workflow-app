import { expect, test } from './extensionFixture';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=',
  'base64',
);

test('protects Assets referenced by an immutable active Session snapshot', async ({
  context,
  extensionUrls,
}) => {
  const networkRequests: string[] = [];
  context.on('request', (request) => {
    if (/^https?:/u.test(request.url())) networkRequests.push(request.url());
  });
  await context.setOffline(true);

  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'forest.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toBeVisible();
  await expect(options.getByAltText('Preview of forest.png')).toBeVisible();

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Forest focus');
  await options.getByLabel('Background image').selectOption({
    label: 'forest.png',
  });
  await options.getByRole('button', { name: 'Save workflow' }).click();

  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByRole('button', { name: 'Retire forest.png' }).click();
  await options.getByRole('button', { name: 'Review usage' }).click();
  await expect(options.getByText('1 reference in 1 Workflow.')).toBeVisible();
  await expect(options.getByText(/Forest focus: 1 direct/)).toBeVisible();
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toBeVisible();
  await options.getByRole('button', { name: 'Cancel' }).click();

  const focus = await context.newPage();
  await focus.goto(extensionUrls.focus);
  await focus.getByRole('button', { name: 'Start Forest focus' }).click();
  await expect(
    focus.getByRole('heading', { name: 'Forest focus' }),
  ).toBeVisible();

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByLabel('Background image').selectOption({ label: 'None' });
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByRole('button', { name: 'Retire forest.png' }).click();
  await options.getByRole('button', { name: 'Review usage' }).click();
  await expect(options.getByRole('alert')).toHaveText(
    'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
  );
  await expect(
    options.getByRole('dialog', { name: 'Retire forest.png' }),
  ).toBeVisible();
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toBeVisible();

  await focus.getByRole('button', { name: 'Stop' }).click();
  await focus.getByRole('button', { name: 'Stop session' }).click();
  await expect(focus.getByText('Session stopped')).toBeVisible();

  await options.getByRole('button', { name: 'Review usage' }).click();
  await options.getByRole('button', { name: 'Continue' }).click();
  await options
    .getByRole('radio', { name: 'Remove optional references' })
    .check();
  await options.getByRole('button', { name: 'Retire asset' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toHaveCount(0);

  expect(networkRequests).toEqual([]);
});

test('creates, follows and explicitly moves an Asset Role', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).focus();
  await options.keyboard.press('Enter');
  for (const name of ['forest.png', 'meadow.png']) {
    await options
      .getByLabel('Add local image or audio')
      .setInputFiles({ name, mimeType: 'image/png', buffer: onePixelPng });
  }
  const roleTrigger = options.getByRole('button', {
    name: 'Manage role for forest.png',
  });
  await roleTrigger.focus();
  await options.keyboard.press('Enter');
  await options
    .getByRole('textbox', { name: 'Role' })
    .pressSequentially('Hero scene');
  await options.getByRole('button', { name: 'Review role' }).focus();
  await options.keyboard.press('Enter');
  await options.getByRole('button', { name: 'Assign role' }).focus();
  await options.keyboard.press('Enter');
  await expect(roleTrigger).toBeFocused();

  await options.getByRole('tab', { name: 'Workflows' }).focus();
  await options.keyboard.press('Enter');
  await options.getByRole('button', { name: 'Create workflow' }).focus();
  await options.keyboard.press('Enter');
  await options.getByLabel('Workflow name').focus();
  await options.keyboard.type('Role focus');
  await options.getByLabel('Background image').focus();
  await options.keyboard.type('Hero scene');
  await expect(options.getByLabel('Background image')).toHaveValue(
    'role:hero scene',
  );
  await options.getByRole('button', { name: 'Add phase' }).focus();
  await options.keyboard.press('Enter');
  await options.getByLabel('Background image').nth(1).focus();
  await options.keyboard.type('forest.png');
  await options.getByRole('button', { name: 'Save workflow' }).focus();
  await options.keyboard.press('Enter');
  await expect(options.getByRole('status')).toHaveText('Workflow saved');

  await options.reload();
  await expect(options.getByLabel('Background image').nth(0)).toHaveValue(
    'role:hero scene',
  );
  await expect(options.getByLabel('Background image').nth(1)).toHaveValue(
    /^direct:/u,
  );

  await options.getByRole('tab', { name: 'Assets' }).click();
  await options
    .getByRole('button', { name: 'Manage role for meadow.png' })
    .click();
  await options.getByRole('textbox', { name: 'Role' }).fill('Hero scene');
  await options.getByRole('button', { name: 'Review role' }).click();
  await expect(
    options.getByText(/currently belongs to forest.png/),
  ).toBeVisible();
  await expect(options.getByText(/affects 1 Workflow/)).toBeVisible();
  await options.getByRole('button', { name: 'Move role' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: meadow.png' }),
  ).toContainText('Role: Hero scene');

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await expect(options.getByLabel('Background image').nth(0)).toHaveValue(
    'role:hero scene',
  );
  await expect(options.getByLabel('Background image').nth(1)).toHaveValue(
    /^direct:/u,
  );
  await options.getByLabel('Background color').nth(0).fill('#112233');
  await options.getByRole('button', { name: 'Save workflow' }).click();
  await expect(options.getByLabel('Background image').nth(0)).toHaveValue(
    'role:hero scene',
  );
  await expect(options.getByLabel('Background image').nth(1)).toHaveValue(
    /^direct:/u,
  );
});

test('retires an Asset by replacing direct Workflow references', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  for (const name of ['old.png', 'new.png']) {
    await options.getByLabel('Add local image or audio').setInputFiles({
      name,
      mimeType: 'image/png',
      buffer: onePixelPng,
    });
  }
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Replacement focus');
  await options
    .getByLabel('Background image')
    .selectOption({ label: 'old.png' });
  await options.getByRole('button', { name: 'Save workflow' }).click();

  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByRole('button', { name: 'Retire old.png' }).click();
  await options.getByRole('button', { name: 'Review usage' }).click();
  await expect(options.getByText(/Replacement focus: 1 direct/)).toBeVisible();
  await options.getByRole('button', { name: 'Continue' }).click();
  await options
    .getByLabel('Replacement Asset')
    .selectOption({ label: 'new.png' });
  await options.getByRole('button', { name: 'Retire asset' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: old.png' }),
  ).toHaveCount(0);

  await options.getByRole('tab', { name: 'Workflows' }).click();
  await expect(
    options.getByLabel('Background image').locator('option:checked'),
  ).toHaveText('new.png');
});

test('retires an Asset with an uploaded replacement', async ({
  context,
  extensionUrls,
}) => {
  const options = await context.newPage();
  await options.goto(extensionUrls.options);
  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByLabel('Add local image or audio').setInputFiles({
    name: 'source.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await options.getByRole('button', { name: 'Create workflow' }).click();
  await options.getByLabel('Workflow name').fill('Uploaded replacement');
  await options
    .getByLabel('Background image')
    .selectOption({ label: 'source.png' });
  await options.getByRole('button', { name: 'Save workflow' }).click();

  await options.getByRole('tab', { name: 'Assets' }).click();
  await options.getByRole('button', { name: 'Retire source.png' }).click();
  await options.getByRole('button', { name: 'Review usage' }).click();
  await options.getByRole('button', { name: 'Continue' }).click();
  await options.getByRole('radio', { name: 'Upload a replacement' }).check();
  await options.getByLabel('Replacement file').setInputFiles({
    name: 'uploaded.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  });
  await options.getByRole('button', { name: 'Retire asset' }).click();

  await expect(
    options.getByRole('listitem', { name: 'Image: source.png' }),
  ).toHaveCount(0);
  await expect(
    options.getByRole('listitem', { name: 'Image: uploaded.png' }),
  ).toBeVisible();
  await expect(
    options.getByRole('button', { name: 'Retire uploaded.png' }),
  ).toBeFocused();
  await options.getByRole('tab', { name: 'Workflows' }).click();
  await expect(
    options.getByLabel('Background image').locator('option:checked'),
  ).toHaveText('uploaded.png');
});
