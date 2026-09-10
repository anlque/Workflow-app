import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset } from '../domain/Asset';
import { StaleAssetRetirementError } from '../application/AssetRetirementErrors';
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
      occurrences: [
        {
          phaseIndex: 0,
          location: 'background',
          referenceMode: 'direct',
          optional: true,
        },
        {
          phaseIndex: 1,
          location: 'background',
          referenceMode: 'role',
          optional: true,
        },
      ],
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
      onSynchronize={() => Promise.resolve()}
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
  test('moves focus through Review, Continue, choices and Back naturally', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Review usage' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(
      await screen.findByRole('button', { name: 'Continue' }),
    ).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('radio', { name: 'Use an existing Asset' }),
    ).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
  });

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

  test('retries synchronization without repeating a committed retirement', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn(() => Promise.resolve());
    const onSynchronize = vi
      .fn()
      .mockRejectedValueOnce(new Error('Catalog reload failed'))
      .mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    setup({ onRetire, onSynchronize, onSuccess });
    await continueToChoice(user);
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Catalog reload failed',
    );
    await user.click(screen.getByRole('button', { name: 'Retry sync' }));
    expect(onRetire).toHaveBeenCalledOnce();
    expect(onSynchronize).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledWith({ type: 'remove' });
  });

  test('returns a stale retirement to Review usage', async () => {
    const user = userEvent.setup();
    const onRetire = vi.fn(() =>
      Promise.reject(new StaleAssetRetirementError()),
    );
    setup({ onRetire });
    await continueToChoice(user);
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Asset usage changed',
    );
    expect(screen.getByRole('button', { name: 'Review usage' })).toBeVisible();
    expect(
      screen.queryByRole('radio', { name: 'Remove optional references' }),
    ).not.toBeInTheDocument();
  });

  test('describes Role transfer only for replacement and Role retirement for removal', async () => {
    const user = userEvent.setup();
    setup();
    await continueToChoice(user);
    expect(
      screen.getByText('Role “Hero” will move to the replacement.'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    expect(
      screen.getByText('Role “Hero” will be retired with this Asset.'),
    ).toBeVisible();
  });

  test('disables removal when the usage contains a required reference', async () => {
    const user = userEvent.setup();
    setup({
      onInspect: () =>
        Promise.resolve({
          asset: source,
          usages: [
            {
              ...preview.usages[0],
              occurrences: [
                ...preview.usages[0].occurrences,
                {
                  phaseIndex: 2,
                  location: 'audio',
                  referenceMode: 'direct',
                  optional: false,
                },
              ],
            },
          ],
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
