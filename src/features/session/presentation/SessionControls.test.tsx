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

  test('confirms Restart phase for an active Bonus', async () => {
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
      onRestartPhase: vi.fn(() => Promise.resolve()),
      onRestartWorkflow: vi.fn(() => Promise.resolve()),
    };
    render(<SessionControls session={bonus} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Restart phase' }));
    expect(
      screen.getByRole('dialog', { name: 'Restart this phase?' }),
    ).toBeVisible();
    const restartButtons = screen.getAllByRole('button', {
      name: 'Restart phase',
    });
    const confirm = restartButtons.at(-1);
    if (confirm === undefined)
      throw new Error('Expected restart confirmation.');
    await user.click(confirm);
    expect(actions.onRestartPhase).toHaveBeenCalledWith(bonus.id, {
      type: 'bonus',
      rewardRitualId: 'bonus-controls-session:0',
    });
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
      onRestartPhase: vi
        .fn(() => Promise.resolve())
        .mockRejectedValueOnce(new Error('Restart unavailable.')),
      onRestartWorkflow: vi.fn(() => Promise.resolve()),
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
      screen.getByRole('dialog', { name: 'Restart this phase?' }),
    ).toBeVisible();

    await user.click(confirm);
    expect(actions.onRestartPhase).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('dialog', { name: 'Restart this phase?' }),
    ).not.toBeInTheDocument();
  });

  test('confirms normal phase and workflow restarts with explicit loss copy', async () => {
    const user = userEvent.setup();
    const session = createSession('normal-restart', workflow, 1_000);
    const actions = {
      ...callbacks(),
      onRestartPhase: vi.fn(() => Promise.resolve()),
      onRestartWorkflow: vi.fn(() => Promise.resolve()),
    };
    render(<SessionControls session={session} {...actions} />);

    const phaseTrigger = screen.getByRole('button', { name: 'Restart phase' });
    await user.click(phaseTrigger);
    expect(
      screen.getByText('Elapsed progress in this phase will be lost.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(phaseTrigger).toHaveFocus();
    await user.click(phaseTrigger);
    const phaseConfirmation = screen
      .getAllByRole('button', { name: 'Restart phase' })
      .at(-1);
    if (phaseConfirmation === undefined)
      throw new Error('Expected phase confirmation.');
    await user.click(phaseConfirmation);
    expect(actions.onRestartPhase).toHaveBeenCalledWith(session.id, {
      type: 'phase',
      phaseIndex: 0,
    });

    await user.click(screen.getByRole('button', { name: 'Restart workflow' }));
    expect(
      screen.getByText(
        'All Session progress and Reward progress will be lost.',
      ),
    ).toBeVisible();
    const workflowConfirmation = screen
      .getAllByRole('button', { name: 'Restart workflow' })
      .at(-1);
    if (workflowConfirmation === undefined)
      throw new Error('Expected workflow confirmation.');
    await user.click(workflowConfirmation);
    expect(actions.onRestartWorkflow).toHaveBeenCalledWith(session.id);
  });

  test('keeps restart confirmation single-flight and available while user-paused', async () => {
    const user = userEvent.setup();
    let finish = (): void => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const session = pauseSession(
      createSession('paused-restart', workflow, 1_000),
      2_000,
    );
    const actions = {
      ...callbacks(),
      onRestartPhase: vi.fn(() => pending),
      onRestartWorkflow: vi.fn(() => Promise.resolve()),
    };
    render(<SessionControls session={session} {...actions} />);

    await user.click(screen.getByRole('button', { name: 'Restart phase' }));
    const confirm = screen.getAllByRole('button', {
      name: 'Restart phase',
    })[1];
    if (confirm === undefined) throw new Error('Expected confirmation.');
    await user.click(confirm);
    await user.click(confirm);

    expect(actions.onRestartPhase).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Restarting…' })).toBeDisabled();
    finish();
  });
});
