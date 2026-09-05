import { useCallback, useEffect, useRef, useState } from 'react';

export type AmbientAudioState =
  'idle' | 'starting' | 'playing' | 'blocked' | 'recovery-blocked' | 'failed';

export type AmbientAudioDeviceChanges = Readonly<{
  addEventListener(type: 'devicechange', listener: EventListener): void;
  removeEventListener(type: 'devicechange', listener: EventListener): void;
}>;

export type AmbientAudioControls = Readonly<{
  audioRef: React.RefObject<HTMLAudioElement | null>;
  sourceUrl: string | null;
  state: AmbientAudioState;
  enable(): Promise<void>;
  resume(): Promise<void>;
}>;

type PlayAttemptKind = 'initial' | 'resume';

const DEFAULT_FADE_DURATION_MS = 1_000;
const RAMP_INTERVAL_MS = 50;
const DEVICE_CHANGE_DEBOUNCE_MS = 150;

function defaultDeviceChanges(): AmbientAudioDeviceChanges | null {
  if (typeof navigator === 'undefined') return null;
  const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
  return typeof mediaDevices?.addEventListener === 'function' &&
    typeof mediaDevices.removeEventListener === 'function'
    ? mediaDevices
    : null;
}

function isRetryableMediaError(error: MediaError | null): boolean {
  return error?.code === 1 || error?.code === 2;
}

function isTerminalPlaybackFailure(
  audio: HTMLAudioElement,
  cause: unknown,
): boolean {
  return (
    audio.error?.code === 3 ||
    audio.error?.code === 4 ||
    (cause instanceof DOMException && cause.name === 'NotSupportedError')
  );
}

export function useAmbientAudio({
  sourceUrl,
  playing,
  volume,
  fadeDurationMs = DEFAULT_FADE_DURATION_MS,
  deviceChanges = defaultDeviceChanges(),
}: Readonly<{
  sourceUrl: string | null;
  playing: boolean;
  volume: number;
  fadeDurationMs?: number;
  deviceChanges?: AmbientAudioDeviceChanges | null;
}>): AmbientAudioControls {
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const deviceTimeoutRef = useRef<number | undefined>(undefined);
  const rampGenerationRef = useRef(0);
  const playGenerationRef = useRef(0);
  const playAttemptRef = useRef<Promise<void> | null>(null);
  const queuedInitialPlayRef = useRef(false);
  const mountedRef = useRef(true);
  const targetVolumeRef = useRef(volume);
  const playingRef = useRef(playing);
  const requestedSourceRef = useRef(sourceUrl);
  const activeSourceRef = useRef<string | null>(null);
  const stateRef = useRef<AmbientAudioState>('idle');
  const attemptPlayRef = useRef<(kind: PlayAttemptKind) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const [activeSourceUrl, setActiveSourceUrl] = useState<string | null>(null);
  const [state, setState] = useState<AmbientAudioState>('idle');

  playingRef.current = playing;
  requestedSourceRef.current = sourceUrl;
  activeSourceRef.current = activeSourceUrl;

  const updateState = useCallback((next: AmbientAudioState): void => {
    stateRef.current = next;
    setState(next);
  }, []);

  const cancelRamp = useCallback((): void => {
    rampGenerationRef.current += 1;
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const clearDeviceCheck = useCallback((): void => {
    if (deviceTimeoutRef.current !== undefined) {
      window.clearTimeout(deviceTimeoutRef.current);
      deviceTimeoutRef.current = undefined;
    }
  }, []);

  const invalidatePlayback = useCallback((): void => {
    playGenerationRef.current += 1;
    queuedInitialPlayRef.current = false;
    clearDeviceCheck();
  }, [clearDeviceCheck]);

  const rampTo = useCallback(
    (target: number, onComplete?: () => void): void => {
      const audio = audioRef.current;
      if (audio === null) return;
      cancelRamp();
      const generation = rampGenerationRef.current;
      const initial = audio.volume;
      const steps = Math.max(1, Math.ceil(fadeDurationMs / RAMP_INTERVAL_MS));
      let step = 0;
      intervalRef.current = window.setInterval(() => {
        if (generation !== rampGenerationRef.current) return;
        step += 1;
        audio.volume = Math.min(
          1,
          Math.max(0, initial + (target - initial) * (step / steps)),
        );
        if (step < steps) return;
        cancelRamp();
        onComplete?.();
      }, RAMP_INTERVAL_MS);
    },
    [cancelRamp, fadeDurationMs],
  );

  const offerResume = useCallback((): void => {
    if (
      !playingRef.current ||
      activeSourceRef.current === null ||
      requestedSourceRef.current !== activeSourceRef.current ||
      stateRef.current === 'idle' ||
      stateRef.current === 'failed'
    ) {
      return;
    }
    updateState('recovery-blocked');
  }, [updateState]);

  const attemptPlay = useCallback(
    (kind: PlayAttemptKind): Promise<void> => {
      const audio = audioRef.current;
      const activeSource = activeSourceRef.current;
      if (
        audio === null ||
        activeSource === null ||
        !playingRef.current ||
        requestedSourceRef.current !== activeSource
      ) {
        return Promise.resolve();
      }
      if (!audio.paused) {
        if (kind === 'initial') rampTo(targetVolumeRef.current);
        updateState('playing');
        return Promise.resolve();
      }
      if (playAttemptRef.current !== null) {
        if (kind === 'initial') queuedInitialPlayRef.current = true;
        return playAttemptRef.current;
      }

      cancelRamp();
      audio.volume = 0;
      updateState('starting');
      const generation = playGenerationRef.current;
      const isCurrent = (): boolean =>
        mountedRef.current &&
        generation === playGenerationRef.current &&
        playingRef.current &&
        activeSourceRef.current === activeSource &&
        requestedSourceRef.current === activeSource;

      const attempt = (async () => {
        try {
          await audio.play();
          if (!isCurrent()) return;
          updateState('playing');
          rampTo(targetVolumeRef.current);
        } catch (cause) {
          if (!isCurrent()) return;
          if (kind === 'resume') {
            updateState(
              isTerminalPlaybackFailure(audio, cause)
                ? 'failed'
                : 'recovery-blocked',
            );
          } else {
            updateState(
              cause instanceof DOMException && cause.name !== 'NotAllowedError'
                ? 'failed'
                : 'blocked',
            );
          }
        } finally {
          playAttemptRef.current = null;
          if (queuedInitialPlayRef.current && mountedRef.current) {
            queuedInitialPlayRef.current = false;
            void attemptPlayRef.current('initial');
          }
        }
      })();
      playAttemptRef.current = attempt;
      return attempt;
    },
    [cancelRamp, rampTo, updateState],
  );
  attemptPlayRef.current = attemptPlay;

  const start = useCallback(
    (): Promise<void> => attemptPlay('initial'),
    [attemptPlay],
  );

  const resume = useCallback(
    (): Promise<void> => attemptPlay('resume'),
    [attemptPlay],
  );

  useEffect(() => {
    targetVolumeRef.current = volume;
    if (state === 'playing' && playingRef.current) rampTo(volume);
  }, [rampTo, state, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (sourceUrl === activeSourceUrl) return;
    invalidatePlayback();
    if (
      activeSourceUrl === null ||
      audio === null ||
      (stateRef.current !== 'playing' && stateRef.current !== 'starting')
    ) {
      setActiveSourceUrl(sourceUrl);
      return;
    }
    rampTo(0, () => {
      updateState('idle');
      audio.pause();
      setActiveSourceUrl(sourceUrl);
    });
  }, [activeSourceUrl, invalidatePlayback, rampTo, sourceUrl, updateState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || activeSourceUrl === null) {
      updateState('idle');
      return;
    }
    if (playing) {
      void start();
      return;
    }
    invalidatePlayback();
    rampTo(0, () => {
      updateState('idle');
      audio.pause();
    });
  }, [
    activeSourceUrl,
    invalidatePlayback,
    playing,
    rampTo,
    start,
    updateState,
  ]);

  useEffect(() => {
    if (deviceChanges === null) return;
    const onDeviceChange: EventListener = () => {
      clearDeviceCheck();
      deviceTimeoutRef.current = window.setTimeout(() => {
        deviceTimeoutRef.current = undefined;
        if (audioRef.current?.paused === true) offerResume();
      }, DEVICE_CHANGE_DEBOUNCE_MS);
    };
    deviceChanges.addEventListener('devicechange', onDeviceChange);
    return () => {
      clearDeviceCheck();
      deviceChanges.removeEventListener('devicechange', onDeviceChange);
    };
  }, [clearDeviceCheck, deviceChanges, offerResume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || activeSourceUrl === null) return;
    const onError = (): void => {
      if (isRetryableMediaError(audio.error)) offerResume();
      else updateState('failed');
    };
    const onPause = (): void => {
      offerResume();
    };
    const onPlaying = (): void => {
      if (
        playingRef.current &&
        activeSourceRef.current !== null &&
        requestedSourceRef.current === activeSourceRef.current
      ) {
        updateState('playing');
      }
    };
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('playing', onPlaying);
    return () => {
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('playing', onPlaying);
    };
  }, [activeSourceUrl, offerResume, updateState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidatePlayback();
      cancelRamp();
      stateRef.current = 'idle';
      audioRef.current?.pause();
    };
  }, [cancelRamp, invalidatePlayback]);

  return {
    audioRef,
    sourceUrl: activeSourceUrl,
    state,
    enable: start,
    resume,
  };
}
