export type UiSoundPlayer = Readonly<{
  unlock(): Promise<boolean>;
  getState(): 'locked' | 'ready' | 'unavailable';
  setVolume(volume: number): void;
  playBell(): void;
  playDiceRoll(durationMs: 600 | 2500): void;
  playSessionComplete(): void;
  playRewardUnlocked(): void;
  dispose(): void;
}>;

export function createUiSoundPlayer(
  createContext: () => AudioContext = () => new AudioContext(),
): UiSoundPlayer {
  let context: AudioContext | undefined;
  let disposed = false;
  let state: 'locked' | 'ready' | 'unavailable' = 'locked';
  let volume = 1;

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

  function setVolume(nextVolume: number): void {
    volume = Math.min(1, Math.max(0, nextVolume));
  }

  function getReadyContext(): AudioContext | undefined {
    return state === 'ready' && volume > 0 ? context : undefined;
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
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, 0.4 * volume),
        start + 0.01,
      );
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
      const peakVolume = Math.max(0.0001, 0.8 * volume);
      masterGain.gain.exponentialRampToValueAtTime(peakVolume, start + 0.02);
      masterGain.gain.setValueAtTime(
        peakVolume,
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

  function playNotes(
    notes: readonly Readonly<{
      frequency: number;
      offset: number;
      duration: number;
      gain: number;
      type?: OscillatorType;
    }>[],
  ): void {
    try {
      const audio = getReadyContext();
      if (audio === undefined) return;
      const start = audio.currentTime;
      for (const note of notes) {
        const noteStart = start + note.offset;
        const oscillator = audio.createOscillator();
        const noteGain = audio.createGain();
        oscillator.type = note.type ?? 'triangle';
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.exponentialRampToValueAtTime(
          Math.max(0.0001, note.gain * volume),
          noteStart + 0.015,
        );
        noteGain.gain.exponentialRampToValueAtTime(
          0.0001,
          noteStart + note.duration,
        );
        oscillator.connect(noteGain);
        noteGain.connect(audio.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + note.duration);
      }
    } catch {
      // UI sounds never interrupt the Session.
    }
  }

  function playSessionComplete(): void {
    playNotes([
      { frequency: 523.25, offset: 0, duration: 0.75, gain: 0.13 },
      { frequency: 659.25, offset: 0, duration: 0.75, gain: 0.13 },
      { frequency: 783.99, offset: 0, duration: 0.75, gain: 0.13 },
    ]);
  }

  function playRewardUnlocked(): void {
    playNotes([
      {
        frequency: 1_046.5,
        offset: 0,
        duration: 0.3,
        gain: 0.07,
        type: 'square',
      },
      {
        frequency: 1_318.51,
        offset: 0.12,
        duration: 0.3,
        gain: 0.07,
        type: 'square',
      },
      {
        frequency: 1_567.98,
        offset: 0.24,
        duration: 0.3,
        gain: 0.07,
        type: 'square',
      },
      {
        frequency: 2_093,
        offset: 0.36,
        duration: 0.55,
        gain: 0.08,
        type: 'square',
      },
    ]);
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

  return {
    unlock,
    getState,
    setVolume,
    playBell,
    playDiceRoll,
    playSessionComplete,
    playRewardUnlocked,
    dispose,
  };
}
