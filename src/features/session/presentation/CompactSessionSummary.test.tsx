import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { CompactSessionSummary } from './CompactSessionSummary';

afterEach(() => {
  vi.useRealTimers();
});

function workflow(withBonus = false) {
  return createWorkflow({
    id: 'summary-workflow',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 60, environment: {} },
      { type: 'break', durationSeconds: 30, environment: {} },
    ],
    ...(withBonus
      ? {
          rewardDice: {
            frequency: 1,
            sides: [
              {
                icon: 'tea',
                title: 'Tea',
                bonusPhase: {
                  name: 'Tea break',
                  durationSeconds: 30,
                  environment: {},
                },
              },
              { icon: 'walk', title: 'Walk' },
            ],
          },
        }
      : {}),
  });
}

describe('CompactSessionSummary', () => {
  test('shows the Workflow, normal segment and an updating countdown', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const session = createSession('summary-session', workflow(), now);

    render(<CompactSessionSummary session={session} now={() => now} />);

    expect(screen.getByText('Deep work')).toBeVisible();
    expect(screen.getByText('Focus')).toBeVisible();
    expect(screen.getByLabelText('Compact time remaining')).toHaveTextContent(
      '01:00',
    );

    now = 2_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByLabelText('Compact time remaining')).toHaveTextContent(
      '00:59',
    );
  });

  test('shows the active Bonus and freezes a user-paused countdown', () => {
    const rewardPaused = deriveSessionState(
      createSession('bonus-summary-session', workflow(true), 1_000),
      62_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0, 'roll-summary'),
      70_000,
      'continue-summary',
    );
    const paused = pauseSession(bonus, 75_000);

    render(<CompactSessionSummary session={paused} now={() => 99_000} />);

    expect(screen.getByText('Bonus · Tea break')).toBeVisible();
    expect(screen.getByLabelText('Compact time remaining')).toHaveTextContent(
      '00:25',
    );
  });
});
