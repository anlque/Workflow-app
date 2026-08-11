import { useCallback, useEffect, useRef, useState } from 'react';

export type AmbientAudioState =
  'idle' | 'starting' | 'playing' | 'blocked' | 'failed';

export type AmbientAudioControls = Readonly<{
  audioRef: React.RefObject<HTMLAudioElement | null>;
  sourceUrl: string | null;
  state: AmbientAudioState;
  enable(): Promise<void>;
}>;

const DEFAULT_FADE_DURATION_MS = 1_000;
const RAMP_INTERVAL_MS = 50;

export function useAmbientAudio({
  sourceUrl,
  playing,
  volume,
  fadeDurationMs = DEFAULT_FADE_DURATION_MS,
}: Readonly<{
  sourceUrl: string | null;
  playing: boolean;
  volume: number;
  fadeDurationMs?: number;
}>): AmbientAudioControls {
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<number | undefined>(undefined);
  const generationRef = useRef(0);
  const targetVolumeRef = useRef(volume);
  const [activeSourceUrl, setActiveSourceUrl] = useState<string | null>(null);
  const [state, setState] = useState<AmbientAudioState>('idle');

  const cancelRamp = useCallback((): void => {
    generationRef.current += 1;
    if (intervalRef.current !== undefined) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const rampTo = useCallback(
    (target: number, onComplete?: () => void): void => {
      const audio = audioRef.current;
      if (audio === null) return;
      cancelRamp();
      const generation = generationRef.current;
      const initial = audio.volume;
      const steps = Math.max(1, Math.ceil(fadeDurationMs / RAMP_INTERVAL_MS));
      let step = 0;
      intervalRef.current = window.setInterval(() => {
        if (generation !== generationRef.current) return;
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

  const start = useCallback(async (): Promise<void> => {
    const audio = audioRef.current;
    if (audio === null || activeSourceUrl === null) return;
    cancelRamp();
    audio.volume = 0;
    setState('starting');
    try {
      await audio.play();
      setState('playing');
      rampTo(targetVolumeRef.current);
    } catch (cause) {
      setState(
        cause instanceof DOMException && cause.name !== 'NotAllowedError'
          ? 'failed'
          : 'blocked',
      );
    }
  }, [activeSourceUrl, cancelRamp, rampTo]);

  useEffect(() => {
    targetVolumeRef.current = volume;
    if (state === 'playing') rampTo(volume);
  }, [rampTo, state, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (sourceUrl === activeSourceUrl) return;
    if (
      activeSourceUrl === null ||
      audio === null ||
      (state !== 'playing' && state !== 'starting')
    ) {
      setActiveSourceUrl(sourceUrl);
      return;
    }
    rampTo(0, () => {
      audio.pause();
      setActiveSourceUrl(sourceUrl);
    });
  }, [activeSourceUrl, rampTo, sourceUrl, state]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || activeSourceUrl === null) {
      setState('idle');
      return;
    }
    if (playing) {
      void start();
      return;
    }
    rampTo(0, () => {
      audio.pause();
      setState('idle');
    });
  }, [activeSourceUrl, playing, rampTo, start]);

  useEffect(
    () => () => {
      cancelRamp();
      audioRef.current?.pause();
    },
    [cancelRamp],
  );

  return { audioRef, sourceUrl: activeSourceUrl, state, enable: start };
}
