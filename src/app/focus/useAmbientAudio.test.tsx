import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  useAmbientAudio,
  type AmbientAudioControls,
  type AmbientAudioDeviceChanges,
} from './useAmbientAudio';

class FakeDeviceChanges implements AmbientAudioDeviceChanges {
  readonly target = new EventTarget();
  readonly addEventListener = vi.fn(
    (type: 'devicechange', listener: EventListener): void => {
      this.target.addEventListener(type, listener);
    },
  );
  readonly removeEventListener = vi.fn(
    (type: 'devicechange', listener: EventListener): void => {
      this.target.removeEventListener(type, listener);
    },
  );

  dispatch(): void {
    this.target.dispatchEvent(new Event('devicechange'));
  }
}

function Harness({
  sourceUrl = 'blob:ambient',
  playing = true,
  volume = 0.6,
  deviceChanges,
  onControls,
}: Readonly<{
  sourceUrl?: string | null;
  playing?: boolean;
  volume?: number;
  deviceChanges: AmbientAudioDeviceChanges | null;
  onControls?(controls: AmbientAudioControls): void;
}>) {
  const controls = useAmbientAudio({
    sourceUrl,
    playing,
    volume,
    fadeDurationMs: 100,
    deviceChanges,
  });

  useEffect(() => {
    onControls?.(controls);
  }, [controls, onControls]);

  return controls.sourceUrl === null ? null : (
    <audio
      data-testid="ambient-audio"
      data-state={controls.state}
      ref={controls.audioRef}
      src={controls.sourceUrl}
    />
  );
}

function setPaused(audio: HTMLAudioElement, paused: boolean): void {
  Object.defineProperty(audio, 'paused', { configurable: true, value: paused });
}

function setMediaError(audio: HTMLAudioElement, code: number): void {
  Object.defineProperty(audio, 'error', {
    configurable: true,
    value: { code },
  });
}

async function settleInitialPlayback(): Promise<HTMLAudioElement> {
  const audio = await screen.findByTestId<HTMLAudioElement>('ambient-audio');
  await waitFor(() => {
    expect(audio.dataset['state']).toBe('playing');
  });
  return audio;
}

function captureControls(): Readonly<{
  current(): AmbientAudioControls;
  update(controls: AmbientAudioControls): void;
}> {
  let value: AmbientAudioControls | undefined;
  return {
    current() {
      if (value === undefined) throw new Error('Controls are not ready.');
      return value;
    },
    update(controls) {
      value = controls;
    },
  };
}

describe('useAmbientAudio recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('devicechange does not disturb audio that is still playing', async () => {
    const devices = new FakeDeviceChanges();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
    render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    play.mockClear();
    pause.mockClear();
    setPaused(audio, false);

    act(() => {
      devices.dispatch();
      vi.advanceTimersByTime(150);
    });

    expect(audio.dataset['state']).toBe('playing');
    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  test('expected but paused audio offers Resume', async () => {
    const devices = new FakeDeviceChanges();
    render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    setPaused(audio, true);

    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });

    await waitFor(() => {
      expect(audio.dataset['state']).toBe('recovery-blocked');
    });
  });

  test('playing immediately removes a stale Resume state', async () => {
    const devices = new FakeDeviceChanges();
    render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });
    await waitFor(() => {
      expect(audio.dataset['state']).toBe('recovery-blocked');
    });

    setPaused(audio, false);
    act(() => {
      audio.dispatchEvent(new Event('playing'));
    });

    expect(audio.dataset['state']).toBe('playing');
  });

  test('Resume uses the same element and browser position without pause, load or seek', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load');
    render(<Harness deviceChanges={devices} onControls={controls.update} />);
    const audio = await settleInitialPlayback();
    play.mockClear();
    pause.mockClear();
    audio.currentTime = 27.25;
    const seek = vi.fn();
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      get: () => 27.25,
      set: seek,
    });
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });

    await act(async () => controls.current().resume());

    expect(screen.getByTestId('ambient-audio')).toBe(audio);
    expect(play).toHaveBeenCalledOnce();
    expect(play.mock.instances[0]).toBe(audio);
    expect(pause).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(27.25);
    expect(seek).not.toHaveBeenCalled();
  });

  test('a stale Resume callback is a no-op after audio starts playing', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(<Harness deviceChanges={devices} onControls={controls.update} />);
    const audio = await settleInitialPlayback();
    play.mockClear();
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });
    const staleResume = controls.current().resume;
    setPaused(audio, false);
    act(() => {
      audio.dispatchEvent(new Event('playing'));
    });

    await act(staleResume);

    expect(play).not.toHaveBeenCalled();
    expect(audio.dataset['state']).toBe('playing');
  });

  test('double Resume does not create parallel play calls', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    let finishPlay: (() => void) | undefined;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(<Harness deviceChanges={devices} onControls={controls.update} />);
    const audio = await settleInitialPlayback();
    play.mockClear();
    play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = resolve;
        }),
    );
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
      void controls.current().resume();
      void controls.current().resume();
    });

    expect(play).toHaveBeenCalledOnce();
    await act(async () => {
      finishPlay?.();
      await Promise.resolve();
    });
  });

  test.each([1, 2])('retryable media error %s offers Resume', async (code) => {
    const devices = new FakeDeviceChanges();
    render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    setMediaError(audio, code);

    act(() => {
      audio.dispatchEvent(new Event('error'));
    });

    expect(audio.dataset['state']).toBe('recovery-blocked');
  });

  test.each([3, 4])('terminal media error %s enters failed', async (code) => {
    const devices = new FakeDeviceChanges();
    render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    setMediaError(audio, code);

    act(() => {
      audio.dispatchEvent(new Event('error'));
    });

    expect(audio.dataset['state']).toBe('failed');
  });

  test('late Resume completion cannot restore a replaced source', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    let finishOldPlay: (() => void) | undefined;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { rerender } = render(
      <Harness deviceChanges={devices} onControls={controls.update} />,
    );
    const audio = await settleInitialPlayback();
    play.mockClear();
    play
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOldPlay = resolve;
          }),
      )
      .mockResolvedValueOnce();
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
      void controls.current().resume();
    });

    rerender(
      <Harness
        sourceUrl="blob:next"
        deviceChanges={devices}
        onControls={controls.update}
      />,
    );
    await act(async () => {
      finishOldPlay?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(audio).toHaveAttribute('src', 'blob:next');
      expect(audio.dataset['state']).toBe('playing');
    });
  });

  test('late Resume completion cannot restart a stopped session', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    let finishPlay: (() => void) | undefined;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { rerender } = render(
      <Harness deviceChanges={devices} onControls={controls.update} />,
    );
    const audio = await settleInitialPlayback();
    play.mockClear();
    play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = resolve;
        }),
    );
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
      void controls.current().resume();
    });

    rerender(
      <Harness
        playing={false}
        deviceChanges={devices}
        onControls={controls.update}
      />,
    );
    await act(async () => {
      finishPlay?.();
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(audio.dataset['state']).toBe('idle');
    expect(play).toHaveBeenCalledOnce();
  });

  test('late Resume completion after unmount is inert', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    let finishPlay: (() => void) | undefined;
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { unmount } = render(
      <Harness deviceChanges={devices} onControls={controls.update} />,
    );
    const audio = await settleInitialPlayback();
    play.mockClear();
    play.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPlay = resolve;
        }),
    );
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
      void controls.current().resume();
    });

    unmount();
    await act(async () => {
      finishPlay?.();
      await Promise.resolve();
    });

    expect(play).toHaveBeenCalledOnce();
  });

  test('cleans up the device listener and pending debounce timeout', async () => {
    const devices = new FakeDeviceChanges();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { unmount } = render(<Harness deviceChanges={devices} />);
    const audio = await settleInitialPlayback();
    play.mockClear();
    setPaused(audio, true);
    act(() => {
      devices.dispatch();
    });
    const listener = devices.addEventListener.mock.calls[0]?.[1];

    unmount();
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(devices.removeEventListener).toHaveBeenCalledWith(
      'devicechange',
      listener,
    );
    expect(play).not.toHaveBeenCalled();
  });

  test('successful Resume fades to the latest volume', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const { rerender } = render(
      <Harness
        volume={0.8}
        deviceChanges={devices}
        onControls={controls.update}
      />,
    );
    const audio = await settleInitialPlayback();
    play.mockClear();
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });
    rerender(
      <Harness
        volume={0.25}
        deviceChanges={devices}
        onControls={controls.update}
      />,
    );

    await act(async () => controls.current().resume());
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(audio.volume).toBeCloseTo(0.25);
  });

  test('Session resume cancels an unfinished fade-out without replaying audio', async () => {
    const devices = new FakeDeviceChanges();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const { rerender } = render(
      <Harness playing volume={0.6} deviceChanges={devices} />,
    );
    const audio = await settleInitialPlayback();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    play.mockClear();
    pause.mockClear();
    setPaused(audio, false);

    rerender(<Harness playing={false} volume={0.6} deviceChanges={devices} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender(<Harness playing volume={0.6} deviceChanges={devices} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(play).not.toHaveBeenCalled();
    expect(pause).not.toHaveBeenCalled();
    expect(audio.dataset['state']).toBe('playing');
    expect(audio.volume).toBeCloseTo(0.6);
  });

  test('volume changes do not cancel an unfinished Session fade-out', async () => {
    const devices = new FakeDeviceChanges();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    const { rerender } = render(
      <Harness playing volume={0.6} deviceChanges={devices} />,
    );
    const audio = await settleInitialPlayback();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    pause.mockClear();
    setPaused(audio, false);

    rerender(<Harness playing={false} volume={0.6} deviceChanges={devices} />);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender(<Harness playing={false} volume={0.2} deviceChanges={devices} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(pause).toHaveBeenCalledOnce();
    expect(audio.dataset['state']).toBe('idle');
  });

  test('tolerates an unavailable devicechange API', async () => {
    const view = render(<Harness deviceChanges={null} />);
    await settleInitialPlayback();
    expect(() => {
      view.unmount();
    }).not.toThrow();
  });

  test('remains usable after StrictMode effect cleanup and setup', async () => {
    const devices = new FakeDeviceChanges();
    const controls = captureControls();
    render(
      <StrictMode>
        <Harness deviceChanges={devices} onControls={controls.update} />
      </StrictMode>,
    );
    const audio = await settleInitialPlayback();
    setPaused(audio, true);
    act(() => {
      audio.dispatchEvent(new Event('pause'));
    });

    await act(async () => controls.current().resume());

    expect(audio.dataset['state']).toBe('playing');
  });
});
