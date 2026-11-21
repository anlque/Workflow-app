import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createAsset } from '../domain/Asset';
import { AssetPreview } from './AssetPreview';

const image = createAsset({
  id: 'image-1',
  name: 'Forest',
  kind: 'image',
  mimeType: 'image/png',
  byteSize: 1,
  createdAt: 1_000,
});
const audio = createAsset({
  id: 'audio-1',
  name: 'Rain',
  kind: 'audio',
  mimeType: 'audio/mpeg',
  byteSize: 1,
  createdAt: 2_000,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AssetPreview', () => {
  test('reports real image dimensions after the local preview loads', async () => {
    const onMetadata = vi.fn();
    render(
      <AssetPreview
        asset={image}
        loadBlob={() => Promise.resolve(new Blob(['image']))}
        createObjectUrl={() => 'blob:forest'}
        revokeObjectUrl={() => undefined}
        onMetadata={onMetadata}
      />,
    );
    const preview = await screen.findByRole('img', {
      name: 'Preview of Forest',
    });
    Object.defineProperties(preview, {
      naturalWidth: { value: 1_920 },
      naturalHeight: { value: 1_080 },
    });
    fireEvent.load(preview);

    expect(onMetadata).toHaveBeenCalledWith({
      kind: 'image',
      width: 1_920,
      height: 1_080,
    });
  });

  test('reports only finite positive audio duration', async () => {
    const onMetadata = vi.fn();
    const view = render(
      <AssetPreview
        asset={audio}
        loadBlob={() => Promise.resolve(new Blob(['audio']))}
        createObjectUrl={() => 'blob:rain'}
        revokeObjectUrl={() => undefined}
        onMetadata={onMetadata}
      />,
    );
    const preview = await screen.findByLabelText('Preview Rain');
    Object.defineProperty(preview, 'duration', {
      value: Number.POSITIVE_INFINITY,
      configurable: true,
    });
    fireEvent.loadedMetadata(preview);
    Object.defineProperty(preview, 'duration', {
      value: 0,
      configurable: true,
    });
    fireEvent.loadedMetadata(preview);
    Object.defineProperty(preview, 'duration', {
      value: 90,
      configurable: true,
    });
    fireEvent.loadedMetadata(preview);

    expect(onMetadata).toHaveBeenCalledOnce();
    expect(onMetadata).toHaveBeenCalledWith({
      kind: 'audio',
      durationSeconds: 90,
    });
    view.unmount();
  });

  test('does not report invalid image dimensions', async () => {
    const onMetadata = vi.fn();
    render(
      <AssetPreview
        asset={image}
        loadBlob={() => Promise.resolve(new Blob(['image']))}
        createObjectUrl={() => 'blob:forest'}
        revokeObjectUrl={() => undefined}
        onMetadata={onMetadata}
      />,
    );
    const preview = await screen.findByRole('img', {
      name: 'Preview of Forest',
    });
    Object.defineProperties(preview, {
      naturalWidth: { value: 0 },
      naturalHeight: { value: Number.NaN },
    });
    fireEvent.load(preview);

    expect(onMetadata).not.toHaveBeenCalled();
  });

  test('keeps the playing audio URL across callback-only rerenders', async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue();
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => undefined);
    const blob = new Blob(['audio'], { type: 'audio/mpeg' });
    const createObjectUrl = vi.fn(() => 'blob:rain');
    const firstRevoke = vi.fn();
    const view = render(
      <AssetPreview
        asset={audio}
        loadBlob={() => Promise.resolve(blob)}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={firstRevoke}
      />,
    );
    const playing = await screen.findByLabelText('Preview Rain');
    (playing as HTMLAudioElement).currentTime = 12;
    await (playing as HTMLAudioElement).play();

    view.rerender(
      <AssetPreview
        asset={audio}
        loadBlob={() => Promise.resolve(blob)}
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Preview Rain')).toBe(playing);
    expect((playing as HTMLAudioElement).currentTime).toBe(12);
    expect(createObjectUrl).toHaveBeenCalledOnce();
    expect(firstRevoke).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();
  });

  test('releases the previous URL once when the Asset ID changes', async () => {
    const revokeObjectUrl = vi.fn();
    const replacement = createAsset({
      id: 'image-2',
      name: 'Lake',
      kind: 'image',
      mimeType: 'image/png',
      byteSize: 1,
      createdAt: 3_000,
    });
    const view = render(
      <AssetPreview
        asset={image}
        loadBlob={() => Promise.resolve(new Blob(['x']))}
        createObjectUrl={(blob) =>
          blob.size === 1 ? 'blob:forest' : 'blob:other'
        }
        revokeObjectUrl={revokeObjectUrl}
      />,
    );
    await screen.findByRole('img', { name: 'Preview of Forest' });

    view.rerender(
      <AssetPreview
        asset={replacement}
        loadBlob={() => Promise.resolve(new Blob(['xx']))}
        createObjectUrl={(blob) =>
          blob.size === 1 ? 'blob:forest' : 'blob:lake'
        }
        revokeObjectUrl={revokeObjectUrl}
      />,
    );
    await screen.findByRole('img', { name: 'Preview of Lake' });

    expect(revokeObjectUrl.mock.calls).toEqual([['blob:forest']]);
    view.unmount();
    expect(revokeObjectUrl.mock.calls).toEqual([
      ['blob:forest'],
      ['blob:lake'],
    ]);
  });

  test('does not create or revoke a URL when an async load finishes after unmount', async () => {
    let finish!: (blob: Blob) => void;
    const createObjectUrl = vi.fn(() => 'blob:late');
    const revokeObjectUrl = vi.fn();
    const view = render(
      <AssetPreview
        asset={audio}
        loadBlob={() =>
          new Promise((resolve) => {
            finish = resolve;
          })
        }
        createObjectUrl={createObjectUrl}
        revokeObjectUrl={revokeObjectUrl}
      />,
    );
    view.unmount();
    finish(new Blob(['audio']));
    await Promise.resolve();

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  test('owns and revokes the object URL for an image preview', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    const revokeObjectUrl = vi.fn();
    const { unmount } = render(
      <AssetPreview
        asset={image}
        loadBlob={() => Promise.resolve(blob)}
        createObjectUrl={() => 'blob:forest'}
        revokeObjectUrl={revokeObjectUrl}
      />,
    );

    expect(
      await screen.findByRole('img', { name: 'Preview of Forest' }),
    ).toHaveAttribute('src', 'blob:forest');
    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:forest');
  });

  test('shows a quiet unavailable state when content is missing', async () => {
    render(
      <AssetPreview
        asset={image}
        loadBlob={() => Promise.resolve(null)}
        createObjectUrl={() => 'unused'}
        revokeObjectUrl={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Preview unavailable')).toBeVisible();
    });
  });
});
