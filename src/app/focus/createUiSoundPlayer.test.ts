import { describe, expect, test, vi } from 'vitest';

import { createUiSoundPlayer } from './createUiSoundPlayer';

type Ramp = Readonly<{
  kind: 'set' | 'exponential';
  value: number;
  at: number;
}>;

function createFakeAudioContext(state: AudioContextState = 'running') {
  let currentState = state;
  const ramps: Ramp[] = [];
  const gainRamps: Ramp[][] = [];
  const oscillatorStarts: number[] = [];
  const oscillatorFrequencies: number[] = [];
  const oscillatorTypes: OscillatorType[] = [];
  const bufferSourceStarts: number[] = [];
  const bufferSourceStops: number[] = [];
  const bufferLengths: number[] = [];
  const stereoPans: number[] = [];
  const resume = vi.fn(() => {
    currentState = 'running';
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());
  const parameter = (target: Ramp[] = ramps) => ({
    setValueAtTime(value: number, at: number) {
      target.push({ kind: 'set', value, at });
    },
    exponentialRampToValueAtTime(value: number, at: number) {
      target.push({ kind: 'exponential', value, at });
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
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource: () => ({
      ...connectable,
      buffer: null,
      start: (at: number) => bufferSourceStarts.push(at),
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
    bufferLengths,
    stereoPans,
    resume,
    close,
  };
}

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

  test('synthesizes the accepted pulsing full-duration dice roll', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(() => fake.context);

    await player.unlock();
    player.playDiceRoll(2_500);

    expect(fake.bufferSourceStarts).toEqual([1]);
    expect(fake.bufferLengths).toEqual([20_000]);
    expect(fake.bufferSourceStops).toEqual([3.5]);
    expect(
      fake.gainRamps.some(
        (values) => values.filter(({ value }) => value === 0.5).length > 10,
      ),
    ).toBe(true);
    expect(fake.stereoPans).toEqual([]);
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
    player.dispose();
    player.dispose();

    expect(fake.close).toHaveBeenCalledOnce();
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
