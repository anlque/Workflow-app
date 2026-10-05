import { afterEach, describe, expect, test, vi } from 'vitest';

import { createUiSoundPlayer } from './createUiSoundPlayer';

type Ramp = Readonly<{
  kind: 'set' | 'exponential' | 'linear';
  value: number;
  at: number;
}>;

function createFakeAudioContext(state: AudioContextState = 'running') {
  let currentState = state;
  let failNextBufferSourceStart = false;
  const ramps: Ramp[] = [];
  const gainRamps: Ramp[][] = [];
  const oscillatorStarts: number[] = [];
  const oscillatorFrequencies: number[] = [];
  const oscillatorTypes: OscillatorType[] = [];
  const bufferSourceStarts: number[] = [];
  const bufferSourceStops: number[] = [];
  const bufferSourceStartArguments: number[][] = [];
  const bufferLengths: number[] = [];
  const stereoPans: number[] = [];
  const resume = vi.fn(() => {
    currentState = 'running';
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());
  const decodeAudioData = vi.fn(() =>
    Promise.resolve({ duration: 2.5 } as AudioBuffer),
  );
  const parameter = (target: Ramp[] = ramps) => ({
    setValueAtTime(value: number, at: number) {
      target.push({ kind: 'set', value, at });
    },
    exponentialRampToValueAtTime(value: number, at: number) {
      target.push({ kind: 'exponential', value, at });
    },
    linearRampToValueAtTime(value: number, at: number) {
      target.push({ kind: 'linear', value, at });
    },
    value: 0,
  });
  const connectable = { connect: vi.fn() };
  const context = {
    get state() {
      return currentState;
    },
    currentTime: 1,
    sampleRate: 8_000,
    destination: {},
    resume,
    close,
    decodeAudioData,
    createOscillator: () => {
      let type: OscillatorType = 'sine';
      return {
        ...connectable,
        frequency: {
          ...parameter(),
          setValueAtTime(value: number, at: number) {
            oscillatorFrequencies.push(value);
            ramps.push({ kind: 'set', value, at });
          },
        },
        get type() {
          return type;
        },
        set type(value: OscillatorType) {
          type = value;
          oscillatorTypes.push(value);
        },
        start: (at: number) => oscillatorStarts.push(at),
        stop: vi.fn(),
      };
    },
    createGain: () => {
      const values: Ramp[] = [];
      gainRamps.push(values);
      return { ...connectable, gain: parameter(values) };
    },
    createBuffer: (_channels: number, length: number) => {
      bufferLengths.push(length);
      return {
        duration: length / context.sampleRate,
        getChannelData: () => new Float32Array(length),
      };
    },
    createBufferSource: () => ({
      ...connectable,
      buffer: null,
      start: (...args: number[]) => {
        if (failNextBufferSourceStart) {
          failNextBufferSourceStart = false;
          throw new Error('playback failed');
        }
        bufferSourceStarts.push(args[0] ?? 0);
        bufferSourceStartArguments.push(args);
      },
      stop: (at: number) => bufferSourceStops.push(at),
    }),
    createBiquadFilter: () => ({
      ...connectable,
      type: 'lowpass',
      frequency: parameter(),
      Q: { value: 0 },
    }),
    createStereoPanner: () => ({
      ...connectable,
      pan: {
        setValueAtTime(value: number) {
          stereoPans.push(value);
        },
        value: 0,
      },
    }),
  };
  return {
    context: context as unknown as AudioContext,
    ramps,
    gainRamps,
    oscillatorStarts,
    oscillatorFrequencies,
    oscillatorTypes,
    bufferSourceStarts,
    bufferSourceStops,
    bufferSourceStartArguments,
    bufferLengths,
    stereoPans,
    resume,
    close,
    decodeAudioData,
    failNextBufferSourceStart() {
      failNextBufferSourceStart = true;
    },
    setCurrentTime(value: number) {
      context.currentTime = value;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createUiSoundPlayer', () => {
  test('synthesizes a short decaying bell after activation and reuses its audio context', async () => {
    const fake = createFakeAudioContext();
    const createContext = vi.fn(() => fake.context);
    const player = createUiSoundPlayer(createContext);

    await expect(player.unlock()).resolves.toBe(true);
    player.playBell();
    player.playBell();

    expect(createContext).toHaveBeenCalledOnce();
    expect(fake.oscillatorStarts).toHaveLength(2);
    expect(fake.gainRamps.flat().some(({ value }) => value === 0.4)).toBe(true);
  });

  test('applies master volume to generated UI sounds', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(() => fake.context);
    await player.unlock();

    player.setVolume(0.25);
    player.playBell();

    expect(fake.gainRamps.flat().some(({ value }) => value === 0.1)).toBe(true);

    player.setVolume(0);
    player.playBell();
    expect(fake.oscillatorStarts).toHaveLength(1);
  });

  test('plays the packaged roll with overlap across the full animation duration', async () => {
    const fake = createFakeAudioContext();
    const packagedBuffer = {
      duration: 2.5,
    } as AudioBuffer;
    const loadRollBuffer = vi.fn(() => Promise.resolve(packagedBuffer));
    const player = createUiSoundPlayer(() => fake.context, loadRollBuffer);

    await player.unlock();
    const playback = player.playDiceRoll(3_000);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(2);
    });

    expect(loadRollBuffer).toHaveBeenCalledOnce();
    expect(fake.bufferSourceStarts).toEqual([1, 3.35]);
    expect(fake.bufferSourceStartArguments[0]).toEqual([1, 0, 2.5]);
    expect(fake.bufferSourceStartArguments[1]?.slice(0, 2)).toEqual([3.35, 0]);
    expect(fake.bufferSourceStartArguments[1]?.[2]).toBeCloseTo(0.65);
    expect(fake.gainRamps).toEqual([
      [
        { kind: 'set', value: 1, at: 1 },
        { kind: 'set', value: 1, at: 3.75 },
        { kind: 'linear', value: 0, at: 4 },
      ],
      [{ kind: 'set', value: 1, at: 1 }],
      [
        { kind: 'set', value: 0.8, at: 1 },
        { kind: 'set', value: 0.8, at: 3.35 },
        { kind: 'linear', value: 0, at: 3.5 },
      ],
      [
        { kind: 'set', value: 0, at: 3.35 },
        { kind: 'linear', value: 0.8, at: 3.5 },
      ],
    ]);

    playback.stop();
    playback.stop();
    expect(fake.bufferSourceStops).toEqual([1, 1]);
  });

  test('uses a shorter terminal fade for reduced-motion rolls', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(
      () => fake.context,
      () => Promise.resolve({ duration: 2.5 } as AudioBuffer),
    );
    await player.unlock();

    player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(1);
    });

    expect(fake.gainRamps.flat()).toEqual(
      expect.arrayContaining([
        { kind: 'set', value: 1, at: 1.5 },
        { kind: 'linear', value: 0, at: 1.6 },
      ]),
    );
  });

  test('loads and decodes the packaged production roll cue by default', async () => {
    const fake = createFakeAudioContext();
    const bytes = new ArrayBuffer(16);
    const fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(bytes),
      } as Response),
    );
    vi.stubGlobal('fetch', fetch);
    const player = createUiSoundPlayer(() => fake.context);

    await player.unlock();
    player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(1);
    });

    expect(fetch).toHaveBeenCalledWith('/audio/dice-roll.mp3');
    expect(fake.decodeAudioData).toHaveBeenCalledWith(bytes);
  });

  test('stops an active roll before restart and applies live master volume', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(
      () => fake.context,
      () => Promise.resolve({ duration: 2.5 } as AudioBuffer),
    );
    await player.unlock();
    player.playDiceRoll(3_000);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(2);
    });

    player.setVolume(0.25);
    expect(fake.gainRamps.flat()).toContainEqual({
      kind: 'set',
      value: 0.25,
      at: 1,
    });

    player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(3);
    });
    expect(fake.bufferSourceStops).toEqual([1, 1]);
    expect(fake.bufferSourceStartArguments[2]).toEqual([1, 0, 0.6]);
  });

  test('keeps live volume independent from the terminal fade envelope', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(
      () => fake.context,
      () => Promise.resolve({ duration: 2.5 } as AudioBuffer),
    );
    await player.unlock();
    player.playDiceRoll(3_000);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(2);
    });

    fake.setCurrentTime(2.5);
    player.setVolume(0);
    fake.setCurrentTime(3.8);
    player.setVolume(0.35);

    expect(fake.gainRamps).toEqual(
      expect.arrayContaining([
        [
          { kind: 'set', value: 1, at: 1 },
          { kind: 'set', value: 1, at: 3.75 },
          { kind: 'linear', value: 0, at: 4 },
        ],
        [
          { kind: 'set', value: 1, at: 1 },
          { kind: 'set', value: 0, at: 2.5 },
          { kind: 'set', value: 0.35, at: 3.8 },
        ],
      ]),
    );
  });

  test('uses stoppable synthesis when packaged roll loading fails', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(
      () => fake.context,
      () => Promise.reject(new Error('decode failed')),
    );
    await player.unlock();

    const playback = player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferLengths).toEqual([4_800]);
    });
    expect(fake.bufferSourceStartArguments).toContainEqual([1]);

    playback.stop();
    playback.stop();
    expect(fake.bufferSourceStops).toEqual([1]);
  });

  test('uses synthesis when packaged roll playback fails', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(
      () => fake.context,
      () => Promise.resolve({ duration: 2.5 } as AudioBuffer),
    );
    await player.unlock();
    fake.failNextBufferSourceStart();

    player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferLengths).toEqual([4_800]);
    });

    expect(fake.bufferSourceStartArguments).toEqual([[1]]);
  });

  test('does not consume sounds while locked and unlocks a suspended context', async () => {
    const fake = createFakeAudioContext('suspended');
    const player = createUiSoundPlayer(() => fake.context);

    player.playBell();

    expect(fake.oscillatorStarts).toHaveLength(0);
    expect(player.getState()).toBe('locked');
    await expect(player.unlock()).resolves.toBe(true);
    expect(player.getState()).toBe('ready');
    player.playBell();
    expect(fake.oscillatorStarts).toHaveLength(1);
  });

  test('synthesizes distinct completion and Reward celebrations', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(() => fake.context);
    await player.unlock();

    player.playSessionComplete();
    expect(fake.oscillatorStarts).toEqual([1, 1, 1]);
    expect(fake.oscillatorTypes).toEqual(['triangle', 'triangle', 'triangle']);

    fake.oscillatorStarts.length = 0;
    fake.oscillatorFrequencies.length = 0;
    fake.oscillatorTypes.length = 0;
    player.playRewardUnlocked();
    expect(
      fake.oscillatorStarts.map((value) => Number(value.toFixed(2))),
    ).toEqual([1, 1.12, 1.24, 1.36]);
    expect(fake.oscillatorFrequencies).toEqual([
      1_046.5, 1_318.51, 1_567.98, 2_093,
    ]);
    expect(fake.oscillatorTypes).toEqual([
      'square',
      'square',
      'square',
      'square',
    ]);
  });

  test('disposes its audio context once', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(() => fake.context);

    await player.unlock();
    player.playDiceRoll(600);
    await vi.waitFor(() => {
      expect(fake.bufferSourceStarts).toHaveLength(1);
    });
    player.dispose();
    player.dispose();

    expect(fake.close).toHaveBeenCalledOnce();
    expect(fake.bufferSourceStops).toEqual([1]);
  });

  test('reports unavailable audio and keeps failures non-blocking', async () => {
    const player = createUiSoundPlayer(() => {
      throw new Error('Audio unavailable.');
    });

    await expect(player.unlock()).resolves.toBe(false);
    expect(player.getState()).toBe('unavailable');
    expect(() => {
      player.playBell();
    }).not.toThrow();
    expect(() => {
      player.playDiceRoll(600);
    }).not.toThrow();
    expect(() => {
      player.dispose();
    }).not.toThrow();
  });
});
