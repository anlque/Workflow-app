import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createAsset, type AssetId, type AssetKind } from '../domain/Asset';
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

function setup(
  overrides: Partial<{
    onImport(file: File, kind: AssetKind): Promise<void>;
    onDelete(id: AssetId): Promise<void>;
  }> = {},
) {
  const onImport = vi.fn<(file: File, kind: AssetKind) => Promise<void>>(
    overrides.onImport ?? (() => Promise.resolve()),
  );
  const onDelete = vi.fn<(id: AssetId) => Promise<void>>(
    overrides.onDelete ?? (() => Promise.resolve()),
  );
  render(
    <AssetLibrary
      assets={[image, audio]}
      onImport={onImport}
      onDelete={onDelete}
      loadBlob={() => Promise.resolve(null)}
      createObjectUrl={() => 'blob:asset'}
      revokeObjectUrl={() => undefined}
    />,
  );
  return { onImport, onDelete };
}

describe('AssetLibrary', () => {
  test('keeps an audio preview URL across equivalent catalog rerenders', async () => {
    const blob = new Blob(['audio'], { type: 'audio/mpeg' });
    const createObjectUrl = vi.fn(() => 'blob:rain');
    const revokeObjectUrl = vi.fn();
    const view = render(
      <AssetLibrary
        assets={[audio]}
        onImport={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
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
        onDelete={() => Promise.resolve()}
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

  test('preserves a referenced Asset and announces deletion failure', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup({
      onDelete: () =>
        Promise.reject(new Error('Asset is referenced by 1 Workflow.')),
    });

    await user.click(screen.getByRole('button', { name: 'Delete Forest' }));
    await user.click(screen.getByRole('button', { name: 'Delete asset' }));

    expect(onDelete).toHaveBeenCalledWith(image.id);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Asset is referenced by 1 Workflow.',
    );
    expect(screen.getByText('Forest')).toBeVisible();
  });

  test('keeps the deletion dialog open with the active Session error', async () => {
    const user = userEvent.setup();
    setup({
      onDelete: () =>
        Promise.reject(
          new Error(
            'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
          ),
        ),
    });

    await user.click(screen.getByRole('button', { name: 'Delete Forest' }));
    await user.click(screen.getByRole('button', { name: 'Delete asset' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete Forest?' });
    expect(dialog).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Asset is used by the active Session. Stop the Session or wait for it to finish before deleting it.',
    );
    expect(screen.getByText('Forest')).toBeVisible();
  });

  test('closes the dialog after successful deletion', async () => {
    const user = userEvent.setup();
    const { onDelete } = setup();

    await user.click(screen.getByRole('button', { name: 'Delete Forest' }));
    await user.click(screen.getByRole('button', { name: 'Delete asset' }));

    expect(onDelete).toHaveBeenCalledWith(image.id);
    expect(
      screen.queryByRole('dialog', { name: 'Delete Forest?' }),
    ).not.toBeInTheDocument();
  });
});
