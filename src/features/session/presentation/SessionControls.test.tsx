import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  rollSessionReward,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { SessionControls } from './SessionControls';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
});

function callbacks() {
  return {
    onPause: vi.fn(() => Promise.resolve()),
    onResume: vi.fn(() => Promise.resolve()),
    onStop: vi.fn(() => Promise.resolve()),
  };
}

describe('SessionControls', () => {
  test('pauses a running Session and confirms stop', async () => {
    const user = userEvent.setup();
    const session = createSession('session-1', workflow, 1_000);
    const actions = callbacks();
    render(<SessionControls session={session} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(
      screen.getByRole('dialog', { name: 'Stop this session?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Stop session' }));

    expect(actions.onPause).toHaveBeenCalledWith(session.id);
    expect(actions.onStop).toHaveBeenCalledWith(session.id);
  });

  test('resumes a paused Session and reports command errors', async () => {
    const user = userEvent.setup();
    const session = pauseSession(
      createSession('session-1', workflow, 1_000),
      11_000,
    );
    const actions = callbacks();
    actions.onResume.mockRejectedValueOnce(
      new Error('Background unavailable.'),
    );
    render(<SessionControls session={session} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Resume' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Background unavailable.',
    );
  });

  test('renders no controls during a Phase transition', () => {
    const transitioning = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      61_000,
    );

    render(<SessionControls session={transitioning} {...callbacks()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('does not offer ordinary Resume for a Reward pause', () => {
    const rewarded = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Rewarded work',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          { icon: 'tea', title: 'Tea' },
          { icon: 'walk', title: 'Walk' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('session-1', rewarded, 1_000),
      12_000,
    );

    render(<SessionControls session={rewardPaused} {...callbacks()} />);

    expect(screen.getByText('Reward pending')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Resume' }),
    ).not.toBeInTheDocument();
  });

  test('confirms Restart phase only for an active Bonus', async () => {
    const user = userEvent.setup();
    const rewarded = createWorkflow({
      id: 'bonus-controls',
      name: 'Bonus controls',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('bonus-controls-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0),
      4_000,
      'continue-controls',
    );
    const actions = {
      ...callbacks(),
      onRestart: vi.fn(() => Promise.resolve()),
    };
    render(<SessionControls session={bonus} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Restart phase' }));
    expect(
      screen.getByRole('dialog', { name: 'Restart this Bonus Phase?' }),
    ).toBeVisible();
    const restartButtons = screen.getAllByRole('button', {
      name: 'Restart phase',
    });
    const confirm = restartButtons.at(-1);
    if (confirm === undefined)
      throw new Error('Expected restart confirmation.');
    await user.click(confirm);
    expect(actions.onRestart).toHaveBeenCalledWith(
      bonus.id,
      'bonus-controls-session:0',
    );
  });

  test('keeps a failed Bonus restart recoverable in the confirmation dialog', async () => {
    const user = userEvent.setup();
    const rewarded = createWorkflow({
      id: 'bonus-retry',
      name: 'Bonus retry',
      phases: [
        { type: 'focus', durationSeconds: 1, environment: {} },
        { type: 'break', durationSeconds: 1, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: 'a',
            title: 'A',
            bonusPhase: {
              name: 'Bonus',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: 'b', title: 'B' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('bonus-retry-session', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0),
      4_000,
      'continue-retry',
    );
    const actions = {
      ...callbacks(),
      onRestart: vi
        .fn(() => Promise.resolve())
        .mockRejectedValueOnce(new Error('Restart unavailable.')),
    };
    render(<SessionControls session={bonus} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Restart phase' }));
    const confirm = screen.getAllByRole('button', {
      name: 'Restart phase',
    })[1];
    if (confirm === undefined)
      throw new Error('Expected restart confirmation.');
    await user.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Restart unavailable.',
    );
    expect(
      screen.getByRole('dialog', { name: 'Restart this Bonus Phase?' }),
    ).toBeVisible();

    await user.click(confirm);
    expect(actions.onRestart).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('dialog', { name: 'Restart this Bonus Phase?' }),
    ).not.toBeInTheDocument();
  });
});
