import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import {
  continueRewardSession,
  createSession,
  pauseSession,
  restartSessionWorkflow,
  rollSessionReward,
  stopSession,
} from '../domain/Session';
import { deriveSessionState } from '../domain/deriveSessionState';
import { ActiveSessionView } from './ActiveSessionView';

const actions = {
  onPause: vi.fn(() => Promise.resolve()),
  onResume: vi.fn(() => Promise.resolve()),
  onStop: vi.fn(() => Promise.resolve()),
};

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 1, environment: {} },
    { type: 'break', durationSeconds: 1, environment: {} },
  ],
  rewardDice: {
    frequency: 1,
    rerolls: 1,
    sides: [
      { icon: '☕', title: 'Tea' },
      { icon: '🌿', title: 'Fresh air' },
    ],
  },
});

function interaction() {
  return {
    onRoll: vi.fn(),
    rollReward: vi.fn(() => Promise.resolve()),
    rerollReward: vi.fn(() => Promise.resolve()),
    continueReward: vi.fn(() => Promise.resolve()),
  };
}

describe('ActiveSessionView', () => {
  test.each([
    [
      'running',
      createSession(
        'presentation-running-session',
        createWorkflow({
          id: 'presentation-running-workflow',
          name: 'Presentation running',
          phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
        }),
        1_000,
      ),
    ],
    [
      'paused',
      pauseSession(
        createSession(
          'presentation-paused-session',
          createWorkflow({
            id: 'presentation-paused-workflow',
            name: 'Presentation paused',
            phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
          }),
          1_000,
        ),
        2_000,
      ),
    ],
    [
      'transitioning',
      deriveSessionState(
        createSession(
          'presentation-transition-session',
          createWorkflow({
            id: 'presentation-transition-workflow',
            name: 'Presentation transition',
            phases: [
              { type: 'focus', durationSeconds: 1, environment: {} },
              { type: 'break', durationSeconds: 60, environment: {} },
            ],
          }),
          1_000,
        ),
        2_000,
      ),
    ],
  ] as const)(
    'exposes the authoritative %s presentation state',
    (state, session) => {
      const { container } = render(
        <ActiveSessionView session={session} now={() => 2_000} {...actions} />,
      );

      expect(container.querySelector('.active-session')).toHaveAttribute(
        'data-session-state',
        state,
      );
    },
  );

  test('distinguishes ordinary and Bonus presentation segments', () => {
    const ordinary = createSession(
      'presentation-state-session',
      createWorkflow({
        id: 'presentation-state-workflow',
        name: 'Presentation state',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
      1_000,
    );
    const bonusWorkflow = createWorkflow({
      id: 'presentation-bonus-workflow',
      name: 'Presentation Bonus',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: '☕',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const reward = deriveSessionState(
      createSession('presentation-bonus-session', bonusWorkflow, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(reward, () => 0, 'presentation-bonus-roll'),
      4_000,
      'presentation-bonus-continue',
    );

    const { container, rerender } = render(
      <ActiveSessionView session={ordinary} now={() => 1_000} {...actions} />,
    );
    expect(container.querySelector('.active-session')).toHaveAttribute(
      'data-session-segment',
      'ordinary',
    );

    rerender(
      <ActiveSessionView session={bonus} now={() => 4_000} {...actions} />,
    );
    expect(container.querySelector('.active-session')).toHaveAttribute(
      'data-session-segment',
      'bonus',
    );
  });
  test('shows phase and anchor-derived countdown', () => {
    render(
      <ActiveSessionView
        session={createSession('session-1', workflow, 1_000)}
        now={() => 1_250}
        {...actions}
      />,
    );
    expect(screen.getByText('Focus · Phase 1 of 2')).toBeVisible();
    expect(screen.getByText('00:01')).toBeVisible();
  });

  test('renders authoritative Reward state after remount', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const rolled = rollSessionReward(paused, () => 0);
    const callbacks = interaction();
    const first = render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    expect(screen.getByText('Tea')).toBeVisible();
    first.unmount();
    render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    expect(screen.getByText('Tea')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Roll again · 1 left' }),
    ).toBeVisible();
  });

  test('requests authoritative roll and continue commands', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const callbacks = interaction();
    render(
      <ActiveSessionView
        session={paused}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }));
    expect(callbacks.rollReward).toHaveBeenCalledWith(
      paused.id,
      paused.rewardRitual?.id,
    );
  });

  test('requests authoritative Continue for a hydrated result', () => {
    const paused = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    const rolled = rollSessionReward(paused, () => 0, 'roll-1');
    const callbacks = interaction();
    render(
      <ActiveSessionView
        session={rolled}
        rewardInteraction={callbacks}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(callbacks.continueReward).toHaveBeenCalledWith(
      paused.id,
      paused.rewardRitual?.id,
    );
  });

  test('keeps a final Reward visible before acknowledgment', () => {
    const finalWorkflow = createWorkflow({
      mode: 'detailed',
      id: 'workflow-final',
      name: workflow.name,
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      ...(workflow.rewardDice === undefined
        ? {}
        : {
            rewardDice: {
              schedule: workflow.rewardDice.schedule,
              rerolls: workflow.rewardDice.rerolls,
              sides: workflow.rewardDice.sides.map((side) => ({
                icon: side.icon,
                title: side.title,
                weight: side.probability,
                availability: side.availability,
              })),
            },
          }),
    });
    const paused = deriveSessionState(
      createSession('session-final', finalWorkflow, 1_000),
      3_000,
    );
    render(
      <ActiveSessionView
        session={paused}
        rewardInteraction={interaction()}
        {...actions}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: 'Reward unlocked' }),
    ).toBeVisible();
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument();
  });

  test.each([
    [
      'completed',
      deriveSessionState(
        createSession(
          'completed-navigation',
          createWorkflow({
            id: 'completed-navigation-workflow',
            name: 'Completed navigation',
            phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
          }),
          1_000,
        ),
        3_000,
      ),
    ],
    [
      'stopped',
      stopSession(createSession('stopped-navigation', workflow, 1_000), 1_500),
    ],
  ] as const)(
    'offers Back to workflows for a %s Session',
    async (state, session) => {
      const user = userEvent.setup();
      const onBackToWorkflows = vi.fn();
      const { container } = render(
        <ActiveSessionView
          session={session}
          onBackToWorkflows={onBackToWorkflows}
          {...actions}
        />,
      );

      expect(container.querySelector('.active-session')).toHaveAttribute(
        'data-session-state',
        state,
      );

      await user.click(
        screen.getByRole('button', { name: 'Back to workflows' }),
      );

      expect(onBackToWorkflows).toHaveBeenCalledOnce();
    },
  );

  test('renders transitions, reports boundaries and renders terminal state', () => {
    const running = createSession('session-1', workflow, 1_000);
    const transitioning = deriveSessionState(running, 2_000);
    const onPhaseBoundary = vi.fn();
    const { rerender } = render(
      <ActiveSessionView
        session={running}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={transitioning}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );
    expect(screen.getByText('Transitioning to the next phase…')).toBeVisible();
    expect(onPhaseBoundary).toHaveBeenCalledOnce();

    const ordinary = createSession(
      'ordinary-session',
      createWorkflow({
        id: 'ordinary',
        name: 'Ordinary',
        phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
      }),
      1_000,
    );
    rerender(
      <ActiveSessionView
        session={deriveSessionState(ordinary, 3_000)}
        {...actions}
      />,
    );
    expect(screen.getByText('Session complete')).toBeVisible();
  });

  test('does not report a Phase boundary when restarting the Workflow from Bonus', () => {
    const bonusWorkflow = createWorkflow({
      mode: 'detailed',
      id: 'bonus-restart-cue',
      name: workflow.name,
      phases: workflow.phases,
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: '☕',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('bonus-restart-cue-session', bonusWorkflow, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0, 'roll-before-restart'),
      4_000,
      'continue-before-restart',
    );
    const restarted = restartSessionWorkflow(
      bonus,
      5_000,
      'workflow-restart-from-bonus',
    );
    const onPhaseBoundary = vi.fn();
    const { rerender } = render(
      <ActiveSessionView
        session={bonus}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={restarted}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    expect(onPhaseBoundary).not.toHaveBeenCalled();
  });

  test('reports a real boundary after the immediate workflow restart update was missed', () => {
    const bonusWorkflow = createWorkflow({
      mode: 'detailed',
      id: 'missed-bonus-restart-cue',
      name: workflow.name,
      phases: workflow.phases,
      rewardDice: {
        frequency: 1,
        sides: [
          {
            icon: '☕',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 30,
              environment: {},
            },
          },
          { icon: '🌿', title: 'Fresh air' },
        ],
      },
    });
    const rewardPaused = deriveSessionState(
      createSession('missed-bonus-restart-session', bonusWorkflow, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(rewardPaused, () => 0, 'roll-before-missed-restart'),
      4_000,
      'continue-before-missed-restart',
    );
    const restarted = restartSessionWorkflow(
      bonus,
      5_000,
      'missed-workflow-restart',
    );
    const transitioning = deriveSessionState(restarted, 6_000);
    const onPhaseBoundary = vi.fn();
    const { rerender } = render(
      <ActiveSessionView
        session={bonus}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    rerender(
      <ActiveSessionView
        session={transitioning}
        onPhaseBoundary={onPhaseBoundary}
        {...actions}
      />,
    );

    expect(onPhaseBoundary).toHaveBeenCalledOnce();
  });
});
