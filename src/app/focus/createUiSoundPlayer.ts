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

export type CueType =
  'phase-bell' | 'dice-roll' | 'reward-unlocked' | 'session-complete';
type CueBufferLoader = (
  context: AudioContext,
  cue: CueType,
) => Promise<AudioBuffer>;

const CUE_URLS: Readonly<Record<CueType, string>> = Object.freeze({
  'phase-bell': '/audio/phase-bell.mp3',
  'dice-roll': '/audio/dice-roll.mp3',
  'reward-unlocked': '/audio/reward-unlocked.mp3',
  'session-complete': '/audio/session-complete.mp3',
});
const CUE_TYPES = Object.freeze(Object.keys(CUE_URLS) as CueType[]);
const ROLL_CROSSFADE_SECONDS = 0.15;

async function loadCueBuffer(
  context: AudioContext,
  cue: CueType,
): Promise<AudioBuffer> {
  const response = await fetch(CUE_URLS[cue]);
  if (!response.ok) throw new Error('UI cue failed to load.');
  return context.decodeAudioData(await response.arrayBuffer());
}

export function createUiSoundPlayer(
  createContext: () => AudioContext = () => new AudioContext(),
  loadBuffer: CueBufferLoader = loadCueBuffer,
): UiSoundPlayer {
  let context: AudioContext | undefined;
  let disposed = false;
  let state: 'locked' | 'ready' | 'unavailable' = 'locked';
  let volume = 1;
  const bufferPromises = new Map<CueType, Promise<AudioBuffer>>();
  const activeOneShots = new Set<
    Readonly<{ source: AudioBufferSourceNode; volumeGain: GainNode }>
  >();
  let activeRoll:
    | {
        stopped: boolean;
        sources: AudioBufferSourceNode[];
        volumeGain: GainNode | undefined;
        handle: UiSoundPlayback;
      }
    | undefined;

  function getCueBuffer(
    audio: AudioContext,
    cue: CueType,
  ): Promise<AudioBuffer> {
    let promise = bufferPromises.get(cue);
    if (promise === undefined) {
      promise = loadBuffer(audio, cue);
      bufferPromises.set(cue, promise);
    }
    return promise;
  }

  async function unlock(): Promise<boolean> {
    if (disposed || state === 'unavailable') return false;
    try {
      context ??= createContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      state = context.state === 'running' ? 'ready' : 'locked';
      if (state === 'ready') {
        for (const cue of CUE_TYPES) {
          void getCueBuffer(context, cue).catch(() => undefined);
        }
      }
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
    if (context !== undefined) {
      for (const oneShot of activeOneShots) {
        oneShot.volumeGain.gain.setValueAtTime(volume, context.currentTime);
      }
    }
  }

  function getReadyContext(): AudioContext | undefined {
    return state === 'ready' && volume > 0 ? context : undefined;
  }

  function playSyntheticBell(): void {
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

  function playOneShot(cue: Exclude<CueType, 'dice-roll'>): void {
    const audio = getReadyContext();
    if (audio === undefined) return;
    const fallback =
      cue === 'phase-bell'
        ? playSyntheticBell
        : cue === 'reward-unlocked'
          ? playSyntheticRewardUnlocked
          : playSyntheticSessionComplete;
    let fallbackUsed = false;
    const useFallback = (): void => {
      if (fallbackUsed || disposed || getReadyContext() === undefined) return;
      fallbackUsed = true;
      fallback();
    };
    void getCueBuffer(audio, cue).then((buffer) => {
      if (disposed || getReadyContext() !== audio) return;
      try {
        const source = audio.createBufferSource();
        const gain = audio.createGain();
        source.buffer = buffer;
        gain.gain.setValueAtTime(volume, audio.currentTime);
        source.connect(gain);
        gain.connect(audio.destination);
        const oneShot = { source, volumeGain: gain };
        source.onended = () => {
          activeOneShots.delete(oneShot);
        };
        source.start(audio.currentTime);
        activeOneShots.add(oneShot);
      } catch {
        useFallback();
      }
    }, useFallback);
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
    void getCueBuffer(audio, 'dice-roll').then(
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

  function playSyntheticSessionComplete(): void {
    playNotes([
      { frequency: 523.25, offset: 0, duration: 0.75, gain: 0.13 },
      { frequency: 659.25, offset: 0, duration: 0.75, gain: 0.13 },
      { frequency: 783.99, offset: 0, duration: 0.75, gain: 0.13 },
    ]);
  }

  function playSyntheticRewardUnlocked(): void {
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

  function playBell(): void {
    playOneShot('phase-bell');
  }

  function playSessionComplete(): void {
    playOneShot('session-complete');
  }

  function playRewardUnlocked(): void {
    playOneShot('reward-unlocked');
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    state = 'unavailable';
    activeRoll?.handle.stop();
    if (context !== undefined) {
      for (const { source } of activeOneShots) {
        try {
          source.stop(context.currentTime);
        } catch {
          // A naturally ended source needs no further cleanup.
        }
      }
      activeOneShots.clear();
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
