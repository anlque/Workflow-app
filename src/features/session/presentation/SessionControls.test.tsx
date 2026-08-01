import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession, pauseSession } from '../domain/Session';
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

    expect(screen.getByText('Reward pending — open focus view')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Resume' }),
    ).not.toBeInTheDocument();
  });
});
