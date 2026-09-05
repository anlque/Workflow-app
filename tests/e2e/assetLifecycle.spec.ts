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
  await options.getByRole('button', { name: 'Delete forest.png' }).click();
  await options.getByRole('button', { name: 'Delete asset' }).click();
  await expect(options.getByRole('alert')).toHaveText(
    'Asset is referenced by 1 Workflow.',
  );
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
  await options.getByRole('button', { name: 'Delete forest.png' }).click();
  await options.getByRole('button', { name: 'Delete asset' }).click();
  await expect(options.getByRole('alert')).toHaveText(
    'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
  );
  await expect(
    options.getByRole('dialog', { name: 'Delete forest.png?' }),
  ).toBeVisible();
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toBeVisible();

  await focus.getByRole('button', { name: 'Stop' }).click();
  await focus.getByRole('button', { name: 'Stop session' }).click();
  await expect(focus.getByText('Session stopped')).toBeVisible();

  await options.getByRole('button', { name: 'Delete asset' }).click();
  await expect(
    options.getByRole('listitem', { name: 'Image: forest.png' }),
  ).toHaveCount(0);

  expect(networkRequests).toEqual([]);
});
