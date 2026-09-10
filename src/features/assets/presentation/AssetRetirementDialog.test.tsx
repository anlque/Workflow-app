import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset } from '../domain/Asset';
import { AssetRetirementDialog } from './AssetRetirementDialog';

const source = createAsset({
  id: 'source',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
  role: 'Hero',
});
const replacement = createAsset({
  id: 'replacement',
  name: 'Meadow',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 2,
});
const preview = {
  asset: source,
  usages: [
    {
      workflowId: 'workflow',
      workflowName: 'Deep work',
      directReferenceCount: 1,
      roleReferenceCount: 1,
      optionalReferenceCount: 2,
      requiredReferenceCount: 0,
    },
  ],
} as const;

function setup(
  overrides: Partial<React.ComponentProps<typeof AssetRetirementDialog>> = {},
) {
  const onRetire = vi.fn(() => Promise.resolve());
  render(
    <AssetRetirementDialog
      asset={source}
      assets={[source, replacement]}
      onInspect={() => Promise.resolve(preview)}
      onRetire={onRetire}
      createUploadInput={(file, kind) => ({
        id: 'uploaded',
        name: file.name,
        kind,
        blob: file,
        createdAt: 3,
      })}
      onCancel={() => undefined}
      onSuccess={() => undefined}
      {...overrides}
    />,
  );
  return { onRetire };
}

async function continueToChoice(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Review usage' }));
  await user.click(await screen.findByRole('button', { name: 'Continue' }));
}

describe('AssetRetirementDialog', () => {
  test('keeps a pending review open on Escape', async () => {
    const user = userEvent.setup();
    let resolveInspection: ((value: typeof preview) => void) | undefined;
    const onCancel = vi.fn();
    setup({
      onCancel,
      onInspect: () =>
        new Promise((resolve) => {
          resolveInspection = resolve;
        }),
    });
    await user.click(screen.getByRole('button', { name: 'Review usage' }));
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Retire Forest' })).toBeVisible();
    resolveInspection?.(preview);
  });

  test('confirms replacement with an existing same-kind Asset', async () => {
    const user = userEvent.setup();
    const { onRetire } = setup();
    await continueToChoice(user);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Replacement Asset' }),
      replacement.id,
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(onRetire).toHaveBeenCalledWith(preview, {
      type: 'existing',
      assetId: replacement.id,
    });
  });

  test('passes an uploaded replacement through the injected input factory', async () => {
    const user = userEvent.setup();
    const { onRetire } = setup();
    await continueToChoice(user);
    await user.click(
      screen.getByRole('radio', { name: 'Upload a replacement' }),
    );
    const file = new File(['x'], 'new.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Replacement file'), file);
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(onRetire).toHaveBeenCalledWith(preview, {
      type: 'upload',
      input: expect.objectContaining({ id: 'uploaded', blob: file }) as unknown,
    });
  });

  test('keeps the dialog open after a recoverable retirement error', async () => {
    const user = userEvent.setup();
    const onRetire = vi
      .fn()
      .mockRejectedValueOnce(new Error('Transaction failed'))
      .mockResolvedValueOnce(undefined);
    setup({ onRetire });
    await continueToChoice(user);
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Transaction failed',
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(onRetire).toHaveBeenCalledTimes(2);
  });

  test('disables removal when the usage contains a required reference', async () => {
    const user = userEvent.setup();
    setup({
      onInspect: () =>
        Promise.resolve({
          asset: source,
          usages: [{ ...preview.usages[0], requiredReferenceCount: 1 }],
        }),
    });
    await continueToChoice(user);
    expect(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    ).toBeDisabled();
    expect(
      screen.getByText('Required references need a replacement Asset.'),
    ).toBeVisible();
  });
});
