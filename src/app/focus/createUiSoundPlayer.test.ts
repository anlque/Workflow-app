import { describe, expect, test, vi } from 'vitest';

import { createUiSoundPlayer } from './createUiSoundPlayer';

type Ramp = Readonly<{ kind: 'set' | 'exponential'; value: number }>;

function createFakeAudioContext(state: AudioContextState = 'running') {
  let currentState = state;
  const ramps: Ramp[] = [];
  const oscillatorStarts: number[] = [];
  const bufferSourceStarts: number[] = [];
  const resume = vi.fn(() => {
    currentState = 'running';
    return Promise.resolve();
  });
  const close = vi.fn(() => Promise.resolve());
  const parameter = {
    setValueAtTime(value: number) {
      ramps.push({ kind: 'set', value });
    },
    exponentialRampToValueAtTime(value: number) {
      ramps.push({ kind: 'exponential', value });
    },
    value: 0,
  };
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
    createOscillator: () => ({
      ...connectable,
      frequency: parameter,
      type: 'sine',
      start: (at: number) => oscillatorStarts.push(at),
      stop: vi.fn(),
    }),
    createGain: () => ({ ...connectable, gain: parameter }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => ({
      ...connectable,
      buffer: null,
      start: (at: number) => bufferSourceStarts.push(at),
      stop: vi.fn(),
    }),
    createBiquadFilter: () => ({
      ...connectable,
      type: 'lowpass',
      frequency: { value: 0 },
      Q: { value: 0 },
    }),
  };
  return {
    context: context as unknown as AudioContext,
    ramps,
    oscillatorStarts,
    bufferSourceStarts,
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
    expect(fake.ramps).toContainEqual({
      kind: 'exponential',
      value: 0.0001,
    });
  });

  test('synthesizes filtered noise for a dice roll after activation', async () => {
    const fake = createFakeAudioContext();
    const player = createUiSoundPlayer(() => fake.context);

    await player.unlock();
    player.playDiceRoll();

    expect(fake.bufferSourceStarts).toHaveLength(1);
    expect(fake.ramps).toContainEqual({ kind: 'exponential', value: 0.0001 });
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
      player.playDiceRoll();
    }).not.toThrow();
    expect(() => {
      player.dispose();
    }).not.toThrow();
  });
});
