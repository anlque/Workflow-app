import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createAssetId } from '@/features/assets';
import type { Environment } from '@/features/workflow';

import { FocusEnvironment } from './FocusEnvironment';

const imageId = createAssetId('image-1');
const audioId = createAssetId('audio-1');
const nextAudioId = createAssetId('audio-2');

function setup(environment: Environment, reducedMotion = false, volume = 1) {
  const loadAssetUrl = vi.fn((id) =>
    Promise.resolve(
      id === imageId
        ? 'blob:image'
        : id === audioId
          ? 'blob:audio'
          : 'blob:next-audio',
    ),
  );
  const releaseAssetUrl = vi.fn();
  const view = render(
    <FocusEnvironment
      environment={environment}
      reducedMotion={reducedMotion}
      playing
      volume={volume}
      loadAssetUrl={loadAssetUrl}
      releaseAssetUrl={releaseAssetUrl}
    />,
  );
  return { ...view, loadAssetUrl, releaseAssetUrl };
}

describe('FocusEnvironment', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    await waitFor(() => {
      expect(document.querySelector('audio')).toHaveAttribute(
        'src',
        'blob:audio',
      );
    });
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
        playing
        volume={1}
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
        playing
        volume={1}
        loadAssetUrl={loadAssetUrl}
        releaseAssetUrl={vi.fn()}
      />,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'A focus environment asset is unavailable.',
    );
  });

  test('autoplays hidden looping audio and fades in over one second', async () => {
    vi.useFakeTimers();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue();
    setup({ audioAssetId: audioId });
    await act(async () => {
      await Promise.resolve();
    });

    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio).not.toHaveAttribute('controls');
    expect(audio).toHaveAttribute('loop');
    expect(play).toHaveBeenCalledOnce();
    expect(audio?.volume).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(audio?.volume).toBe(1);
  });

  test('fades ambient audio to the selected master volume', async () => {
    vi.useFakeTimers();
    setup({ audioAssetId: audioId }, false, 0.35);
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(document.querySelector('audio')?.volume).toBeCloseTo(0.35);
  });

  test('offers a manual audio action when autoplay is blocked', async () => {
    const user = userEvent.setup();
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'))
      .mockResolvedValueOnce();
    setup({ audioAssetId: audioId });

    const enable = await screen.findByRole('button', {
      name: 'Enable audio',
    });
    await user.click(enable);

    expect(play).toHaveBeenCalledTimes(2);
  });

  test('fades out the current track before playing a phase replacement', async () => {
    vi.useFakeTimers();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { rerender, loadAssetUrl, releaseAssetUrl } = setup({
      audioAssetId: audioId,
    });
    await act(async () => {
      await Promise.resolve();
    });
    pause.mockClear();
    play.mockClear();

    rerender(
      <FocusEnvironment
        environment={{ audioAssetId: nextAudioId }}
        reducedMotion={false}
        playing
        volume={1}
        loadAssetUrl={loadAssetUrl}
        releaseAssetUrl={releaseAssetUrl}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(pause).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(pause).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
    expect(document.querySelector('audio')).toHaveAttribute(
      'src',
      'blob:next-audio',
    );
  });
});
