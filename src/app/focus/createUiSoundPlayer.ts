export type UiSoundPlayer = Readonly<{
  unlock(): Promise<boolean>;
  getState(): 'locked' | 'ready' | 'unavailable';
  playBell(): void;
  playDiceRoll(durationMs: 600 | 2500): void;
  dispose(): void;
}>;

export function createUiSoundPlayer(
  createContext: () => AudioContext = () => new AudioContext(),
): UiSoundPlayer {
  let context: AudioContext | undefined;
  let disposed = false;
  let state: 'locked' | 'ready' | 'unavailable' = 'locked';

  async function unlock(): Promise<boolean> {
    if (disposed || state === 'unavailable') return false;
    try {
      context ??= createContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      state = context.state === 'running' ? 'ready' : 'locked';
      return state === 'ready';
    } catch {
      state = 'unavailable';
      return false;
    }
  }

  function getState(): 'locked' | 'ready' | 'unavailable' {
    return state;
  }

  function getReadyContext(): AudioContext | undefined {
    return state === 'ready' ? context : undefined;
  }

  function playBell(): void {
    try {
      const audio = getReadyContext();
      if (audio === undefined) return;
      const start = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.7);
    } catch {
      // UI sounds never interrupt the Session.
    }
  }

  function playDiceRoll(durationMs: 600 | 2500): void {
    try {
      const audio = getReadyContext();
      if (audio === undefined) return;
      const start = audio.currentTime;
      const duration = durationMs / 1_000;
      const buffer = audio.createBuffer(
        1,
        Math.round(audio.sampleRate * duration),
        audio.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = Math.random() * 2 - 1;
      }
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const pulseGain = audio.createGain();
      const masterGain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1_100;
      filter.Q.value = 0.65;
      masterGain.gain.setValueAtTime(0.0001, start);
      masterGain.gain.exponentialRampToValueAtTime(0.8, start + 0.02);
      masterGain.gain.setValueAtTime(
        0.8,
        start + Math.max(0.02, duration - 0.08),
      );
      masterGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      let impactIndex = 0;
      for (let offset = 0; offset < duration; offset += 0.12) {
        const pulseStart = start + offset;
        const pulsePeak = Math.min(pulseStart + 0.012, start + duration);
        const pulseEnd = Math.min(pulseStart + 0.09, start + duration);
        filter.frequency.setValueAtTime(
          impactIndex % 2 === 0 ? 900 : 1_450,
          pulseStart,
        );
        pulseGain.gain.setValueAtTime(0.0001, pulseStart);
        pulseGain.gain.exponentialRampToValueAtTime(0.5, pulsePeak);
        pulseGain.gain.exponentialRampToValueAtTime(0.0001, pulseEnd);
        impactIndex += 1;
      }
      source.connect(filter);
      filter.connect(pulseGain);
      pulseGain.connect(masterGain);
      masterGain.connect(audio.destination);
      source.start(start);
      source.stop(start + duration);
    } catch {
      // UI sounds never interrupt the Session.
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    state = 'unavailable';
    if (context !== undefined) {
      void context.close().catch(() => undefined);
      context = undefined;
    }
  }

  return { unlock, getState, playBell, playDiceRoll, dispose };
}
