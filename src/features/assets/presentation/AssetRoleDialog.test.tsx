import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, createAssetRole } from '../domain/Asset';
import type { AssetRoleChangePreview } from '../application/AssetRoleChange';
import { AssetRoleDialog } from './AssetRoleDialog';

const target = createAsset({
  id: 'target',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1,
});
const owner = createAsset({
  ...target,
  id: 'owner',
  name: 'Meadow',
  role: 'Hero',
});

test('previews an occupied Role and requires explicit Move role', async () => {
  const user = userEvent.setup();
  const preview: AssetRoleChangePreview = {
    target,
    role: createAssetRole('Hero'),
    action: 'move',
    currentOwner: owner,
    affectedWorkflowCount: 2,
    expectedKinds: ['image'],
  };
  const inspect = vi.fn(() => Promise.resolve(preview));
  const apply = vi.fn(() => Promise.resolve());
  render(
    <AssetRoleDialog
      asset={target}
      onInspect={inspect}
      onApply={apply}
      onCancel={() => undefined}
      onSuccess={() => undefined}
    />,
  );

  await user.type(screen.getByLabelText('Role'), 'Hero');
  await user.click(screen.getByRole('button', { name: 'Review role' }));

  expect(screen.getByText(/currently belongs to Meadow/)).toBeVisible();
  expect(screen.getByText(/2 Workflows/)).toBeVisible();
  expect(apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Move role' }));
  expect(apply).toHaveBeenCalledWith(preview);
});

test.each([
  ['create', 'Assign role', 0],
  ['rename', 'Rename role', 3],
] as const)(
  'reviews a %s operation before applying it',
  async (action, buttonName, affectedWorkflowCount) => {
    const user = userEvent.setup();
    const preview: AssetRoleChangePreview = {
      target:
        action === 'rename' ? createAsset({ ...target, role: 'Old' }) : target,
      role: createAssetRole('New'),
      action,
      currentOwner: null,
      affectedWorkflowCount,
      expectedKinds: [],
    };
    const apply = vi.fn(() => Promise.resolve());
    render(
      <AssetRoleDialog
        asset={preview.target}
        onInspect={() => Promise.resolve(preview)}
        onApply={apply}
        onCancel={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Role' });
    await user.clear(input);
    await user.type(input, 'New');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: buttonName }));
    expect(apply).toHaveBeenCalledWith(preview);
  },
);

test('warns when a move conflicts with the Workflow expected kind', async () => {
  const user = userEvent.setup();
  const audioOwner = createAsset({
    ...owner,
    kind: 'audio',
    mimeType: 'audio/mpeg',
  });
  const preview: AssetRoleChangePreview = {
    target,
    role: createAssetRole('Hero'),
    action: 'move',
    currentOwner: audioOwner,
    affectedWorkflowCount: 1,
    expectedKinds: ['audio'],
  };
  render(
    <AssetRoleDialog
      asset={target}
      onInspect={() => Promise.resolve(preview)}
      onApply={() => Promise.resolve()}
      onCancel={() => undefined}
      onSuccess={() => undefined}
    />,
  );
  await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
  await user.click(screen.getByRole('button', { name: 'Review role' }));
  expect(screen.getByText(/changes Asset kind/)).toBeVisible();
});

test('shows a blocked merge as a recoverable inspection error', async () => {
  const user = userEvent.setup();
  render(
    <AssetRoleDialog
      asset={createAsset({ ...target, role: 'Other' })}
      onInspect={() =>
        Promise.reject(
          new Error('Choose another Asset or enter an available Role name.'),
        )
      }
      onApply={() => Promise.resolve()}
      onCancel={() => undefined}
      onSuccess={() => undefined}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: 'Role' }));
  await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
  await user.click(screen.getByRole('button', { name: 'Review role' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose another Asset or enter an available Role name.',
  );
});

describe('AssetRoleDialog recovery', () => {
  test('shows an inline error and allows retry', async () => {
    const user = userEvent.setup();
    const inspect = vi
      .fn()
      .mockRejectedValueOnce(new Error('Role changed.'))
      .mockResolvedValueOnce({
        target,
        role: createAssetRole('New'),
        action: 'create',
        currentOwner: null,
        affectedWorkflowCount: 0,
        expectedKinds: [],
      });
    render(
      <AssetRoleDialog
        asset={target}
        onInspect={inspect}
        onApply={() => Promise.resolve()}
        onCancel={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    await user.type(screen.getByLabelText('Role'), 'New');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Role changed.');
    expect(screen.getByRole('textbox', { name: 'Role' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    expect(screen.getByRole('button', { name: 'Assign role' })).toBeVisible();
  });

  test('ignores Escape while inspection is pending and keeps its eventual error', async () => {
    const user = userEvent.setup();
    let rejectInspection: ((cause: Error) => void) | undefined;
    const onCancel = vi.fn();
    render(
      <AssetRoleDialog
        asset={target}
        onInspect={() =>
          new Promise((_, reject) => {
            rejectInspection = reject;
          })
        }
        onApply={() => Promise.resolve()}
        onCancel={onCancel}
        onSuccess={() => undefined}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    expect(screen.getByRole('button', { name: 'Reviewing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onCancel).not.toHaveBeenCalled();
    rejectInspection?.(new Error('Inspection failed.'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Inspection failed.',
    );
    expect(screen.getByRole('textbox', { name: 'Role' })).toHaveFocus();
  });

  test('keeps apply failure after pending Escape and allows retry', async () => {
    const user = userEvent.setup();
    const preview: AssetRoleChangePreview = {
      target,
      role: createAssetRole('Hero'),
      action: 'create',
      currentOwner: null,
      affectedWorkflowCount: 0,
      expectedKinds: [],
    };
    let rejectApply: ((cause: Error) => void) | undefined;
    const apply = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectApply = reject;
        }),
    );
    const onCancel = vi.fn();
    render(
      <AssetRoleDialog
        asset={target}
        onInspect={() => Promise.resolve(preview)}
        onApply={apply}
        onCancel={onCancel}
        onSuccess={() => undefined}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Assign role' }));
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(onCancel).not.toHaveBeenCalled();
    rejectApply?.(new Error('Apply failed.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Apply failed.');
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Role' })).toHaveFocus(),
    );
  });

  test('re-inspects and retries after an apply failure', async () => {
    const user = userEvent.setup();
    const preview: AssetRoleChangePreview = {
      target,
      role: createAssetRole('Hero'),
      action: 'create',
      currentOwner: null,
      affectedWorkflowCount: 0,
      expectedKinds: [],
    };
    const apply = vi
      .fn()
      .mockRejectedValueOnce(new Error('Stale preview.'))
      .mockResolvedValueOnce(undefined);
    const success = vi.fn();
    render(
      <AssetRoleDialog
        asset={target}
        onInspect={() => Promise.resolve(preview)}
        onApply={apply}
        onCancel={() => undefined}
        onSuccess={success}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Stale preview.',
    );
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(apply).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledOnce();
  });

  test('uses its explanation as the dialog description', () => {
    render(
      <AssetRoleDialog
        asset={target}
        onInspect={() => Promise.reject(new Error('unused'))}
        onApply={() => Promise.resolve()}
        onCancel={() => undefined}
        onSuccess={() => undefined}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-describedby',
      'asset-role-description',
    );
  });
});
