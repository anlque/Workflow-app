import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

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

describe('AssetPreview', () => {
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
