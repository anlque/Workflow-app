import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RewardCube } from './RewardCube';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RewardCube media presentation', () => {
  test('plays the packaged video from the start and keeps its ended frame', () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue();
    const onTerminal = vi.fn();
    const { rerender } = render(
      <RewardCube
        attemptId={1}
        stage="rolling"
        resultMedia="video"
        reducedMotion={false}
        icon="☕"
        onTerminal={onTerminal}
      />,
    );
    const video = screen.getByTestId<HTMLVideoElement>('reward-dice-video');
    expect(screen.getByTestId('reward-dice-backdrop')).toBeVisible();
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      writable: true,
      value: 2.4,
    });

    rerender(
      <RewardCube
        attemptId={2}
        stage="rolling"
        resultMedia="video"
        reducedMotion={false}
        icon="☕"
        onTerminal={onTerminal}
      />,
    );

    const restartedVideo =
      screen.getByTestId<HTMLVideoElement>('reward-dice-video');
    expect(restartedVideo).not.toBe(video);
    expect(restartedVideo.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);

    fireEvent.ended(restartedVideo);
    expect(onTerminal).toHaveBeenLastCalledWith(2, 'ended');

    rerender(
      <RewardCube
        attemptId={2}
        stage="result"
        resultMedia="video"
        reducedMotion={false}
        icon="☕"
        onTerminal={onTerminal}
      />,
    );
    expect(screen.getByTestId('reward-dice-video')).toBeVisible();
    expect(screen.queryByTestId('reward-dice-poster')).not.toBeInTheDocument();
    expect(screen.getByTestId('reward-dice-overlay')).toBeVisible();
  });

  test.each(['error', 'play rejection', 'timeout'] as const)(
    'settles through the PNG fallback on %s',
    async (failure) => {
      vi.useFakeTimers();
      const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
      if (failure === 'play rejection') {
        play.mockRejectedValue(new Error('decode failed'));
      } else {
        play.mockResolvedValue();
      }
      const onTerminal = vi.fn();
      render(
        <RewardCube
          attemptId={3}
          stage="rolling"
          resultMedia="video"
          reducedMotion={false}
          icon="☕"
          onTerminal={onTerminal}
        />,
      );

      if (failure === 'error') {
        fireEvent.error(screen.getByTestId('reward-dice-video'));
      } else if (failure === 'play rejection') {
        await act(async () => {
          await Promise.resolve();
        });
      } else {
        act(() => {
          vi.advanceTimersByTime(3_799);
        });
        expect(onTerminal).not.toHaveBeenCalled();
        act(() => {
          vi.advanceTimersByTime(1);
        });
      }

      expect(onTerminal).toHaveBeenCalledOnce();
      expect(onTerminal).toHaveBeenCalledWith(3, 'fallback');
    },
  );

  test('uses the static PNG and shortened interval under reduced motion', () => {
    vi.useFakeTimers();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const onTerminal = vi.fn();
    render(
      <RewardCube
        attemptId={4}
        stage="rolling"
        resultMedia="poster"
        reducedMotion
        icon="☕"
        onTerminal={onTerminal}
      />,
    );

    expect(play).not.toHaveBeenCalled();
    expect(screen.getByTestId('reward-dice-poster')).toHaveAttribute(
      'src',
      '/video/reward-dice-final.png',
    );
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(onTerminal).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTerminal).toHaveBeenCalledWith(4, 'reduced');
  });

  test('ignores late work from an replaced attempt and cleans media on unmount', async () => {
    let rejectFirst: ((cause: Error) => void) | undefined;
    vi.spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementationOnce(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const onTerminal = vi.fn();
    const { rerender, unmount } = render(
      <RewardCube
        attemptId={5}
        stage="rolling"
        resultMedia="video"
        reducedMotion={false}
        icon="☕"
        onTerminal={onTerminal}
      />,
    );

    rerender(
      <RewardCube
        attemptId={6}
        stage="rolling"
        resultMedia="video"
        reducedMotion={false}
        icon="☕"
        onTerminal={onTerminal}
      />,
    );
    await act(async () => {
      rejectFirst?.(new Error('late failure'));
      await Promise.resolve();
    });
    expect(onTerminal).not.toHaveBeenCalledWith(5, expect.anything());

    unmount();
    expect(pause).toHaveBeenCalled();
  });

  test('hydrates an existing result from the PNG without playing media', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(
      <RewardCube
        attemptId={0}
        stage="result"
        resultMedia="poster"
        reducedMotion={false}
        icon="☕"
        onTerminal={vi.fn()}
      />,
    );

    expect(play).not.toHaveBeenCalled();
    expect(screen.getByTestId('reward-dice-poster')).toBeVisible();
    expect(screen.getByTestId('reward-dice-overlay')).toHaveTextContent('☕');
    expect(screen.getByTestId('reward-dice-overlay')).not.toHaveAttribute(
      'data-animate',
    );
  });
});
