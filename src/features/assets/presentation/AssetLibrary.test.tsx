import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import {
  createAsset,
  createAssetRole,
  type AssetId,
  type AssetKind,
} from '../domain/Asset';
import type { AssetRetirementPreview } from '../application/AssetRetirement';
import { AssetLibrary } from './AssetLibrary';

const image = createAsset({
  id: 'image-1',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1_024,
  createdAt: 1_000,
});
const audio = createAsset({
  id: 'audio-1',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 2_048,
  createdAt: 2_000,
});
const meadow = createAsset({
  id: 'image-2',
  name: 'Meadow',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1_024,
  createdAt: 3_000,
});

function setup(
  overrides: Partial<{
    onImport(file: File, kind: AssetKind): Promise<void>;
    onDelete(id: AssetId): Promise<void>;
    onInspectRetirement(id: AssetId): Promise<AssetRetirementPreview>;
    assets: readonly (typeof image)[];
  }> = {},
) {
  const assets = overrides.assets ?? [image, audio];
  const onImport = vi.fn<(file: File, kind: AssetKind) => Promise<void>>(
    overrides.onImport ?? (() => Promise.resolve()),
  );
  const onDelete = vi.fn<(id: AssetId) => Promise<void>>(
    overrides.onDelete ?? (() => Promise.resolve()),
  );
  render(
    <AssetLibrary
      assets={assets}
      onImport={onImport}
      onInspectRetirement={
        overrides.onInspectRetirement ??
        ((id) =>
          Promise.resolve({
            asset: assets.find((asset) => asset.id === id) ?? image,
            usages: [],
          }))
      }
      onRetire={(_, choice) =>
        onDelete(choice.type === 'existing' ? choice.assetId : image.id)
      }
      onSynchronizeRetirement={() => Promise.resolve()}
      createRetirementUploadInput={(file, kind) => ({
        id: 'uploaded',
        name: file.name,
        kind,
        blob: file,
        createdAt: 1,
      })}
      onInspectRoleChange={(assetId, value) => {
        const target = assets.find(({ id }) => id === assetId);
        if (target === undefined) return Promise.reject(new Error('missing'));
        return Promise.resolve({
          target,
          role: createAssetRole(value),
          action: 'create',
          currentOwner: null,
          affectedWorkflowCount: 0,
          expectedKinds: [],
        });
      }}
      onApplyRoleChange={() => Promise.resolve()}
      onSynchronizeRoleChange={() => Promise.resolve()}
      loadBlob={() => Promise.resolve(null)}
      createObjectUrl={() => 'blob:asset'}
      revokeObjectUrl={() => undefined}
    />,
  );
  return { onImport, onDelete };
}

describe('AssetLibrary', () => {
  test('explains that Workflows follow the Asset owning a Role', () => {
    setup();
    expect(
      screen.getByText(
        'A Role lets Workflows follow whichever Asset owns that name.',
      ),
    ).toBeVisible();
  });
  test('keeps an audio preview URL across equivalent catalog rerenders', async () => {
    const blob = new Blob(['audio'], { type: 'audio/mpeg' });
    const createObjectUrl = vi.fn(() => 'blob:rain');
    const revokeObjectUrl = vi.fn();
    const view = render(
      <AssetLibrary
        assets={[audio]}
        onImport={() => Promise.resolve()}
        onInspectRetirement={() =>
          Promise.resolve({ asset: audio, usages: [] })
        }
        onRetire={() => Promise.resolve()}
        onSynchronizeRetirement={() => Promise.resolve()}
        createRetirementUploadInput={(file, kind) => ({
          id: 'uploaded',
          name: file.name,
          kind,
          blob: file,
          createdAt: 1,
        })}
        onInspectRoleChange={() => Promise.reject(new Error('unused'))}
        onApplyRoleChange={() => Promise.resolve()}
        onSynchronizeRoleChange={() => Promise.resolve()}
        loadBlob={() => Promise.resolve(blob)}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={revokeObjectUrl}
      />,
    );
    const playing = await screen.findByLabelText('Preview Rain');
    (playing as HTMLAudioElement).currentTime = 9;

    view.rerender(
      <AssetLibrary
        assets={[audio]}
        onImport={() => Promise.resolve()}
        onInspectRetirement={() =>
          Promise.resolve({ asset: audio, usages: [] })
        }
        onRetire={() => Promise.resolve()}
        onSynchronizeRetirement={() => Promise.resolve()}
        createRetirementUploadInput={(file, kind) => ({
          id: 'uploaded',
          name: file.name,
          kind,
          blob: file,
          createdAt: 1,
        })}
        onInspectRoleChange={() => Promise.reject(new Error('unused'))}
        onApplyRoleChange={() => Promise.resolve()}
        onSynchronizeRoleChange={() => Promise.resolve()}
        loadBlob={() => Promise.resolve(blob)}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Preview Rain')).toBe(playing);
    expect((playing as HTMLAudioElement).currentTime).toBe(9);
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  test('identifies image and audio Assets accessibly', () => {
    setup();

    const imageItem = screen.getByRole('listitem', { name: 'Image: Forest' });
    const audioItem = screen.getByRole('listitem', { name: 'Audio: Rain' });
    expect(imageItem).toHaveTextContent('1 KB');
    expect(audioItem).toHaveTextContent('2 KB');
  });

  test('opens Role management from an Asset card', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getAllByText(/No Role/)).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: 'Manage role for Forest' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Manage Role for Forest' }),
    ).toBeVisible();
  });

  test('restores the invoking Role button after Cancel', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', {
      name: 'Manage role for Forest',
    });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
  });

  test('restores the invoking Role button after a successful change', async () => {
    const user = userEvent.setup();
    render(
      <AssetLibrary
        assets={[image]}
        onImport={() => Promise.resolve()}
        onInspectRetirement={() =>
          Promise.resolve({ asset: image, usages: [] })
        }
        onRetire={() => Promise.resolve()}
        onSynchronizeRetirement={() => Promise.resolve()}
        createRetirementUploadInput={(file, kind) => ({
          id: 'uploaded',
          name: file.name,
          kind,
          blob: file,
          createdAt: 1,
        })}
        onInspectRoleChange={(_, value) =>
          Promise.resolve({
            target: image,
            role: createAssetRole(value),
            action: 'create',
            currentOwner: null,
            affectedWorkflowCount: 0,
            expectedKinds: [],
          })
        }
        onApplyRoleChange={() => Promise.resolve()}
        onSynchronizeRoleChange={() => Promise.resolve()}
        loadBlob={() => Promise.resolve(null)}
        createObjectUrl={() => 'blob:asset'}
        revokeObjectUrl={() => undefined}
      />,
    );
    const trigger = screen.getByRole('button', {
      name: 'Manage role for Forest',
    });
    await user.click(trigger);
    await user.type(screen.getByRole('textbox', { name: 'Role' }), 'Hero');
    await user.click(screen.getByRole('button', { name: 'Review role' }));
    await user.click(screen.getByRole('button', { name: 'Assign role' }));
    expect(trigger).toHaveFocus();
  });

  test('infers the media kind and imports a supported file', async () => {
    const user = userEvent.setup();
    const { onImport } = setup();
    const file = new File(['x'], 'forest.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText('Add local image or audio'), file);

    expect(onImport).toHaveBeenCalledWith(file, 'image');
  });

  test('rejects unsupported files before invoking the use case', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { onImport } = setup();
    const file = new File(['x'], 'notes.pdf', { type: 'application/pdf' });

    await user.upload(screen.getByLabelText('Add local image or audio'), file);

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a supported image or audio file.',
    );
  });

  test('shows affected Workflows before retirement', async () => {
    const user = userEvent.setup();
    setup({
      onInspectRetirement: () =>
        Promise.resolve({
          asset: image,
          usages: [
            {
              workflowId: 'workflow-1',
              workflowName: 'Deep work',
              occurrences: [
                {
                  phaseIndex: 0,
                  location: 'background',
                  referenceMode: 'direct',
                  optional: true,
                },
              ],
            },
          ],
        }),
    });

    await user.click(screen.getByRole('button', { name: 'Retire Forest' }));
    await user.click(screen.getByRole('button', { name: 'Review usage' }));

    expect(await screen.findByText(/1 reference in 1 Workflow/)).toBeVisible();
    expect(screen.getByText(/Deep work: 1 direct/)).toBeVisible();
  });

  test('keeps the deletion dialog open with the active Session error', async () => {
    const user = userEvent.setup();
    setup({
      onInspectRetirement: () =>
        Promise.reject(
          new Error(
            'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
          ),
        ),
    });

    await user.click(screen.getByRole('button', { name: 'Retire Forest' }));
    await user.click(screen.getByRole('button', { name: 'Review usage' }));

    const dialog = screen.getByRole('dialog', { name: 'Retire Forest' });
    expect(dialog).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
    );
    expect(screen.getByText('Forest')).toBeVisible();
  });

  test('retires after explicitly choosing optional-reference removal', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();

    await user.click(screen.getByRole('button', { name: 'Retire Forest' }));
    await user.click(screen.getByRole('button', { name: 'Review usage' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(
      screen.getByRole('radio', { name: 'Remove optional references' }),
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));

    expect(onDelete).toHaveBeenCalledWith(image.id);
    expect(
      screen.queryByRole('dialog', { name: 'Retire Forest' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Add local image or audio')).toHaveFocus();
    });
  });

  test('restores the retirement trigger after Cancel', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: 'Retire Forest' });

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(trigger).toHaveFocus();
  });

  test('focuses the surviving replacement after successful retirement', async () => {
    const user = userEvent.setup();
    setup({ assets: [image, meadow] });

    await user.click(screen.getByRole('button', { name: 'Retire Forest' }));
    await user.click(screen.getByRole('button', { name: 'Review usage' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.selectOptions(
      screen.getByLabelText('Replacement Asset'),
      meadow.id,
    );
    await user.click(screen.getByRole('button', { name: 'Retire asset' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Retire Meadow' }),
      ).toHaveFocus();
    });
  });
});
