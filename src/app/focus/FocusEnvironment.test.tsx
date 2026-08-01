import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createAssetId } from '@/features/assets';
import type { Environment } from '@/features/workflow';

import { FocusEnvironment } from './FocusEnvironment';

const imageId = createAssetId('image-1');
const audioId = createAssetId('audio-1');

function setup(environment: Environment, reducedMotion = false) {
  const loadAssetUrl = vi.fn((id) =>
    Promise.resolve(id === imageId ? 'blob:image' : 'blob:audio'),
  );
  const releaseAssetUrl = vi.fn();
  const view = render(
    <FocusEnvironment
      environment={environment}
      reducedMotion={reducedMotion}
      loadAssetUrl={loadAssetUrl}
      releaseAssetUrl={releaseAssetUrl}
    />,
  );
  return { ...view, loadAssetUrl, releaseAssetUrl };
}

describe('FocusEnvironment', () => {
  test('loads local image and audio URLs and releases both on cleanup', async () => {
    const { unmount, releaseAssetUrl } = setup({
      backgroundAssetId: imageId,
      audioAssetId: audioId,
      backgroundColor: '#123456',
    });

    await waitFor(() => {
      expect(document.querySelector('.focus-environment img')).toHaveAttribute(
        'src',
        'blob:image',
      );
    });
    expect(await screen.findByLabelText('Ambient audio')).toHaveAttribute(
      'src',
      'blob:audio',
    );
    unmount();

    expect(releaseAssetUrl).toHaveBeenCalledWith('blob:image');
    expect(releaseAssetUrl).toHaveBeenCalledWith('blob:audio');
  });

  test('releases a replaced image URL', async () => {
    const { rerender, releaseAssetUrl, loadAssetUrl } = setup({
      backgroundAssetId: imageId,
    });
    await waitFor(() => {
      expect(document.querySelector('.focus-environment img')).not.toBeNull();
    });
    loadAssetUrl.mockResolvedValueOnce('blob:new-image');

    rerender(
      <FocusEnvironment
        environment={{ backgroundAssetId: createAssetId('image-2') }}
        reducedMotion={false}
        loadAssetUrl={loadAssetUrl}
        releaseAssetUrl={releaseAssetUrl}
      />,
    );

    await waitFor(() => {
      expect(releaseAssetUrl).toHaveBeenCalledWith('blob:image');
    });
  });

  test('marks the environment as reduced motion', () => {
    setup({}, true);
    expect(screen.getByTestId('focus-environment')).toHaveAttribute(
      'data-reduced-motion',
      'true',
    );
  });

  test('reports a missing referenced Asset without failing the view', async () => {
    const loadAssetUrl = vi.fn(() => Promise.resolve(null));
    render(
      <FocusEnvironment
        environment={{ backgroundAssetId: imageId }}
        reducedMotion={false}
        loadAssetUrl={loadAssetUrl}
        releaseAssetUrl={vi.fn()}
      />,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A focus environment asset is unavailable.',
    );
  });
});
