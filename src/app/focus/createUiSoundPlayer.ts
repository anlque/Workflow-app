export type UiSoundPlayer = Readonly<{
  unlock(): Promise<boolean>;
  getState(): 'locked' | 'ready' | 'unavailable';
  setVolume(volume: number): void;
  playBell(): void;
  playDiceRoll(durationMs: 600 | 3000): UiSoundPlayback;
  playSessionComplete(): void;
  playRewardUnlocked(): void;
  dispose(): void;
}>;

export type UiSoundPlayback = Readonly<{ stop(): void }>;

type RollBufferLoader = (context: AudioContext) => Promise<AudioBuffer>;

const ROLL_SOUND_URL = '/audio/dice-roll.mp3';
const ROLL_CROSSFADE_SECONDS = 0.15;

async function loadRollBuffer(context: AudioContext): Promise<AudioBuffer> {
  const response = await fetch(ROLL_SOUND_URL);
  if (!response.ok) throw new Error('Dice roll sound failed to load.');
  return context.decodeAudioData(await response.arrayBuffer());
}

export function createUiSoundPlayer(
  createContext: () => AudioContext = () => new AudioContext(),
  loadDiceRollBuffer: RollBufferLoader = loadRollBuffer,
): UiSoundPlayer {
  let context: AudioContext | undefined;
  let disposed = false;
  let state: 'locked' | 'ready' | 'unavailable' = 'locked';
  let volume = 1;
  let rollBufferPromise: Promise<AudioBuffer> | undefined;
  let activeRoll:
    | {
        stopped: boolean;
        sources: AudioBufferSourceNode[];
        volumeGain: GainNode | undefined;
        handle: UiSoundPlayback;
      }
    | undefined;

  function getRollBuffer(audio: AudioContext): Promise<AudioBuffer> {
    rollBufferPromise ??= loadDiceRollBuffer(audio);
    return rollBufferPromise;
  }

  async function unlock(): Promise<boolean> {
    if (disposed || state === 'unavailable') return false;
    try {
      context ??= createContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      state = context.state === 'running' ? 'ready' : 'locked';
      if (state === 'ready') void getRollBuffer(context).catch(() => undefined);
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
    if (activeRoll?.volumeGain !== undefined && context !== undefined) {
      activeRoll.volumeGain.gain.setValueAtTime(volume, context.currentTime);
    }
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

  function stopRollSources(
    roll: NonNullable<typeof activeRoll>,
    audio: AudioContext,
  ): void {
    for (const source of roll.sources.splice(0)) {
      try {
        source.stop(audio.currentTime);
      } catch {
        // A naturally ended source needs no further cleanup.
      }
    }
  }

  function scheduleRollFade(
    gain: AudioParam,
    start: number,
    duration: number,
  ): void {
    const fadeDuration = duration <= 0.6 ? 0.1 : 0.25;
    gain.setValueAtTime(1, start);
    gain.setValueAtTime(1, start + duration - fadeDuration);
    gain.linearRampToValueAtTime(0, start + duration);
  }

  function startSyntheticRoll(
    roll: NonNullable<typeof activeRoll>,
    audio: AudioContext,
    duration: number,
  ): void {
    try {
      const start = audio.currentTime;
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
      const envelopeGain = audio.createGain();
      const volumeGain = audio.createGain();
      roll.volumeGain = volumeGain;
      roll.sources.push(source);
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1_100;
      filter.Q.value = 0.65;
      scheduleRollFade(envelopeGain.gain, start, duration);
      volumeGain.gain.setValueAtTime(volume, start);
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
      pulseGain.connect(envelopeGain);
      envelopeGain.connect(volumeGain);
      volumeGain.connect(audio.destination);
      source.start(start);
    } catch {
      // UI sounds never interrupt the Session.
    }
  }

  function startPackagedRoll(
    roll: NonNullable<typeof activeRoll>,
    audio: AudioContext,
    buffer: AudioBuffer,
    duration: number,
  ): void {
    const start = audio.currentTime;
    const envelopeGain = audio.createGain();
    const volumeGain = audio.createGain();
    scheduleRollFade(envelopeGain.gain, start, duration);
    volumeGain.gain.setValueAtTime(volume, start);
    envelopeGain.connect(volumeGain);
    volumeGain.connect(audio.destination);
    roll.volumeGain = volumeGain;
    let offset = 0;
    let previousGain: GainNode | undefined;
    while (offset < duration) {
      const source = audio.createBufferSource();
      const clipGain = audio.createGain();
      const sourceStart = start + offset;
      const clipDuration = Math.min(buffer.duration, duration - offset);
      source.buffer = buffer;
      if (previousGain === undefined) {
        clipGain.gain.setValueAtTime(0.8, sourceStart);
      } else {
        clipGain.gain.setValueAtTime(0, sourceStart);
        clipGain.gain.linearRampToValueAtTime(
          0.8,
          sourceStart + ROLL_CROSSFADE_SECONDS,
        );
        previousGain.gain.setValueAtTime(0.8, sourceStart);
        previousGain.gain.linearRampToValueAtTime(
          0,
          sourceStart + ROLL_CROSSFADE_SECONDS,
        );
      }
      source.connect(clipGain);
      clipGain.connect(envelopeGain);
      source.start(sourceStart, 0, clipDuration);
      roll.sources.push(source);
      previousGain = clipGain;
      if (clipDuration < buffer.duration) break;
      offset += buffer.duration - ROLL_CROSSFADE_SECONDS;
    }
  }

  function playDiceRoll(durationMs: 600 | 3000): UiSoundPlayback {
    activeRoll?.handle.stop();
    const audio = getReadyContext();
    const roll = {
      stopped: false,
      sources: [] as AudioBufferSourceNode[],
      volumeGain: undefined as GainNode | undefined,
      handle: undefined as unknown as UiSoundPlayback,
    };
    const handle: UiSoundPlayback = {
      stop() {
        if (roll.stopped) return;
        roll.stopped = true;
        if (audio !== undefined) stopRollSources(roll, audio);
        if (activeRoll === roll) activeRoll = undefined;
      },
    };
    roll.handle = handle;
    activeRoll = roll;
    if (audio === undefined) return handle;

    const duration = durationMs / 1_000;
    void getRollBuffer(audio).then(
      (buffer) => {
        if (roll.stopped || activeRoll !== roll) return;
        try {
          startPackagedRoll(roll, audio, buffer, duration);
        } catch {
          stopRollSources(roll, audio);
          startSyntheticRoll(roll, audio, duration);
        }
      },
      () => {
        if (!roll.stopped && activeRoll === roll) {
          startSyntheticRoll(roll, audio, duration);
        }
      },
    );
    return handle;
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
    activeRoll?.handle.stop();
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
