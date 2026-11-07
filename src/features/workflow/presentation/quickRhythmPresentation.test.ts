import { describe, expect, test } from 'vitest';

import {
  createQuickRhythmPresentation,
  type QuickRhythmPresentationInput,
} from './quickRhythmPresentation';

const validInput: QuickRhythmPresentationInput = {
  cycleCount: '4',
  focusDurationMinutes: '25',
  shortBreakDurationMinutes: '5',
  longBreak: {
    enabled: true,
    frequency: '2',
    durationMinutes: '15',
  },
  reward: { enabled: true, frequency: '2' },
};

describe('createQuickRhythmPresentation', () => {
  test.each([
    ['empty Focus duration', { focusDurationMinutes: '' }],
    ['sub-step Short Break duration', { shortBreakDurationMinutes: '0.2' }],
  ])('withholds preview for %s', (_label, patch) => {
    expect(
      createQuickRhythmPresentation({ ...validInput, ...patch }),
    ).toBeNull();
  });

  test('withholds preview for an invalid enabled Long Break duration', () => {
    expect(
      createQuickRhythmPresentation({
        ...validInput,
        longBreak: { ...validInput.longBreak, durationMinutes: '0.2' },
      }),
    ).toBeNull();
  });

  test('ignores an invalid disabled Long Break duration', () => {
    expect(
      createQuickRhythmPresentation({
        ...validInput,
        longBreak: {
          ...validInput.longBreak,
          enabled: false,
          durationMinutes: '0.2',
        },
      }),
    ).toHaveLength(4);
  });

  test.each([
    ['cycle whitespace', { cycleCount: ' 4' }],
    ['cycle scientific notation', { cycleCount: '4e0' }],
    [
      'Long Break frequency whitespace',
      {
        longBreak: { ...validInput.longBreak, frequency: ' 2' },
      },
    ],
    [
      'Reward frequency scientific notation',
      { reward: { ...validInput.reward, frequency: '2e0' } },
    ],
  ])('withholds preview for non-canonical %s', (_label, patch) => {
    expect(
      createQuickRhythmPresentation({ ...validInput, ...patch }),
    ).toBeNull();
  });
});
