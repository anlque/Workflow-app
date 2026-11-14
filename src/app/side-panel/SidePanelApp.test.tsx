import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import {
  continueRewardSession,
  createSession,
  deriveSessionState,
  rollSessionReward,
} from '@/features/session';
import { createWorkflow } from '@/features/workflow';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import { SidePanelApp, type SidePanelDependencies } from './SidePanelApp';

function quickWorkflow(id: string, name: string) {
  return createWorkflow({
    mode: 'quick',
    id,
    name,
    configuration: {
      cycleCount: 2,
      focus: { durationSeconds: 1_500, environment: {} },
      shortBreak: { durationSeconds: 300, environment: {} },
    },
  });
}

function dependencies(
  workflows: Awaited<ReturnType<SidePanelDependencies['listWorkflows']>> = [],
  activeSession: Awaited<
    ReturnType<SidePanelDependencies['sessions']['getActive']>
  > = null,
): SidePanelDependencies {
  return {
    preferences: createTestDocumentPreferences(),
    listWorkflows: () => Promise.resolve(workflows),
    subscribeWorkflowChanges: vi.fn(() => vi.fn()),
    openWorkflowStudio: vi.fn(() => Promise.resolve()),
    openWorkflow: vi.fn(() => Promise.resolve()),
    sessions: {
      getActive: () => Promise.resolve(activeSession),
      subscribe: () => vi.fn(),
    },
    startSession: vi.fn(() => Promise.resolve()),
    pauseSession: vi.fn(() => Promise.resolve()),
    resumeSession: vi.fn(() => Promise.resolve()),
    restartPhase: vi.fn(() => Promise.resolve()),
    restartWorkflow: vi.fn(() => Promise.resolve()),
    skipPhase: vi.fn(() => Promise.resolve()),
    skipReward: vi.fn(() => Promise.resolve()),
    rollReward: vi.fn(() => Promise.resolve()),
    rerollReward: vi.fn(() => Promise.resolve()),
    continueReward: vi.fn(() => Promise.resolve()),
    stopSession: vi.fn(() => Promise.resolve()),
    openFocusView: vi.fn(() => Promise.resolve()),
    closeSidePanel: vi.fn(() => Promise.resolve()),
  };
}

describe('SidePanelApp', () => {
  test('keeps the Side Panel shell visible during initial catalog loading', () => {
    const deps = dependencies();
    Object.assign(deps, {
      listWorkflows: () => new Promise<never>(() => undefined),
    });

    render(<SidePanelApp dependencies={deps} />);

    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('main')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Workflows');
  });

  test('keeps the shell visible and recovers after initial catalog failure', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    const listWorkflows = vi
      .fn<SidePanelDependencies['listWorkflows']>()
      .mockRejectedValueOnce(new Error('Catalog unavailable.'))
      .mockResolvedValueOnce([]);
    Object.assign(deps, { listWorkflows });

    render(<SidePanelApp dependencies={deps} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Catalog unavailable.',
    );
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('main')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByText('Build your first focus rhythm.'),
    ).toBeVisible();
    expect(listWorkflows).toHaveBeenCalledTimes(2);
  });

  test('does not hide an active Session when the catalog fails', async () => {
    const workflow = createWorkflow({
      id: 'panel-catalog-failure-workflow',
      name: 'Keep session visible',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    });
    const session = createSession(
      'panel-catalog-failure-session',
      workflow,
      1_000,
    );
    const deps = dependencies([], session);
    Object.assign(deps, {
      listWorkflows: () => Promise.reject(new Error('Catalog unavailable.')),
    });

    render(<SidePanelApp dependencies={deps} />);

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Catalog unavailable.');
    expect(screen.getByRole('banner')).toBeVisible();
  });

  test('renders the themed single-column Side Panel shell', async () => {
    const { container } = render(
      <SidePanelApp dependencies={dependencies()} />,
    );

    await screen.findByText('Build your first focus rhythm.');
    expect(container.querySelector('.side-panel-app')).toHaveAttribute(
      'data-surface',
      'side-panel',
    );
    expect(screen.getByRole('banner')).toBeVisible();
    expect(screen.getByRole('main')).toBeVisible();
  });
  test('routes ordinary, Bonus, and Reward skips once with exact targets', async () => {
    const user = userEvent.setup();
    const rewarded = createWorkflow({
      id: 'panel-skip-routing',
      name: 'Panel skip routing',
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
    const ordinary = createSession(
      'panel-ordinary-skip',
      createWorkflow({
        id: 'panel-ordinary-skip-workflow',
        name: 'Ordinary skip',
        phases: [
          { type: 'focus', durationSeconds: 10, environment: {} },
          { type: 'break', durationSeconds: 10, environment: {} },
        ],
      }),
      1_000,
    );
    const reward = deriveSessionState(
      createSession('panel-reward-skip', rewarded, 1_000),
      3_000,
    );
    const bonus = continueRewardSession(
      rollSessionReward(reward, () => 0),
      4_000,
      'panel-continue-to-bonus',
    );

    const ordinaryDeps = dependencies([], ordinary);
    const ordinaryView = render(<SidePanelApp dependencies={ordinaryDeps} />);
    await user.click(await screen.findByRole('button', { name: 'Skip phase' }));
    expect(ordinaryDeps.skipPhase).toHaveBeenCalledOnce();
    expect(ordinaryDeps.skipPhase).toHaveBeenCalledWith(ordinary.id, {
      type: 'phase',
      phaseIndex: 0,
    });
    ordinaryView.unmount();

    const bonusDeps = dependencies([], bonus);
    const bonusView = render(<SidePanelApp dependencies={bonusDeps} />);
    await user.click(await screen.findByRole('button', { name: 'Skip phase' }));
    expect(bonusDeps.skipPhase).toHaveBeenCalledOnce();
    expect(bonusDeps.skipPhase).toHaveBeenCalledWith(bonus.id, {
      type: 'bonus',
      rewardRitualId: 'panel-reward-skip:0',
    });
    bonusView.unmount();

    const rewardDeps = dependencies([], reward);
    render(<SidePanelApp dependencies={rewardDeps} />);
    await user.click(
      await screen.findByRole('button', { name: 'Skip reward' }),
    );
    expect(rewardDeps.skipReward).toHaveBeenCalledOnce();
    expect(rewardDeps.skipReward).toHaveBeenCalledWith(
      reward.id,
      'panel-reward-skip:0',
    );
  });

  test('shows the compact Workflow empty state', async () => {
    const { container } = render(
      <SidePanelApp dependencies={dependencies()} />,
    );
    expect(
      await screen.findByText('Build your first focus rhythm.'),
    ).toBeVisible();
    expect(container.querySelector('.brand-logo')).toHaveAttribute(
      'src',
      '/brand/locusora-mark.svg',
    );
  });

  test('opens Workflow Studio from the empty state without creating a Workflow', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    render(<SidePanelApp dependencies={deps} />);

    const openStudio = await screen.findByRole('button', {
      name: 'Open Workflow Studio',
    });
    await user.click(openStudio);

    expect(deps.openWorkflowStudio).toHaveBeenCalledOnce();
    expect(deps.openWorkflow).not.toHaveBeenCalled();
  });

  test('keeps empty-state Studio navigation retryable after failure', async () => {
    const user = userEvent.setup();
    let finishOpen: (() => void) | undefined;
    const deps = dependencies();
    vi.mocked(deps.openWorkflowStudio)
      .mockRejectedValueOnce(new Error('Workflow Studio unavailable.'))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishOpen = resolve;
          }),
      );
    render(<SidePanelApp dependencies={deps} />);
    const openStudio = await screen.findByRole('button', {
      name: 'Open Workflow Studio',
    });

    await user.click(openStudio);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workflow Studio unavailable.',
    );

    await user.click(openStudio);
    expect(openStudio).toBeDisabled();
    expect(openStudio).toHaveAttribute('aria-busy', 'true');
    expect(deps.openWorkflowStudio).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishOpen?.();
      await Promise.resolve();
    });
    expect(openStudio).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders a compact grouped chooser without management actions', async () => {
    const quick = quickWorkflow('quick-workflow', 'Quick rhythm');
    const detailed = createWorkflow({
      id: 'detailed-workflow',
      name: 'Detailed rhythm',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });

    render(<SidePanelApp dependencies={dependencies([quick, detailed])} />);

    expect(
      await screen.findByRole('group', { name: 'Quick Workflows' }),
    ).toBeVisible();
    expect(
      screen.getByRole('group', { name: 'Detailed Workflows' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Open Quick rhythm' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Start workflow: Quick rhythm' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Create|New workflow/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Move .* (?:up|down)/u }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Duplicate|Delete/u }),
    ).not.toBeInTheDocument();
  });

  test('keeps compact chooser actions keyboard operable', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'keyboard-workflow',
      name: 'Keyboard rhythm',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    render(<SidePanelApp dependencies={deps} />);

    const open = await screen.findByRole('button', {
      name: 'Open Keyboard rhythm',
    });
    open.focus();
    await user.keyboard('{Enter}');
    expect(deps.openWorkflow).toHaveBeenCalledWith(workflow.id);

    const start = screen.getByRole('button', {
      name: 'Start workflow: Keyboard rhythm',
    });
    start.focus();
    await user.keyboard(' ');
    expect(deps.startSession).toHaveBeenCalledWith(workflow.id);
    expect(deps.openFocusView).toHaveBeenCalledOnce();
  });

  test('opens a Workflow in the options editor', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    );
    expect(deps.openWorkflow).toHaveBeenCalledWith(workflow.id);
  });

  test('keeps Workflow navigation failure inline and allows retry', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-navigation-retry',
      name: 'Retry work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    vi.mocked(deps.openWorkflow)
      .mockRejectedValueOnce(new Error('Workflow Studio unavailable.'))
      .mockResolvedValueOnce(undefined);
    render(<SidePanelApp dependencies={deps} />);
    const open = await screen.findByRole('button', {
      name: 'Open Retry work',
    });

    await user.click(open);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workflow Studio unavailable.',
    );
    expect(open).toBeVisible();

    await user.click(open);
    expect(deps.openWorkflow).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('closes the Side Panel through the injected dependency', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Close side panel' }),
    );

    expect(deps.closeSidePanel).toHaveBeenCalledOnce();
  });

  test('disables the close control and coalesces rapid clicks while pending', async () => {
    let finishClose: (() => void) | undefined;
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishClose = resolve;
          }),
      ),
    });
    render(<SidePanelApp dependencies={deps} />);
    const close = await screen.findByRole('button', {
      name: 'Close side panel',
    });

    fireEvent.click(close);
    fireEvent.click(close);
    fireEvent.click(close);

    expect(close).toBeDisabled();
    expect(close).toHaveAttribute('aria-busy', 'true');
    expect(close).toHaveTextContent('Closing…');
    expect(deps.closeSidePanel).toHaveBeenCalledOnce();

    await act(async () => {
      finishClose?.();
      await Promise.resolve();
    });
  });

  test('shows a recoverable close error without hiding Side Panel content', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi.fn(() =>
        Promise.reject(new Error('Unable to close the Side Panel. Try again.')),
      ),
    });
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Close side panel' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to close the Side Panel. Try again.',
    );
    expect(screen.getByText('Build your first focus rhythm.')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Close side panel' }),
    ).toBeEnabled();
  });

  test('allows retrying Side Panel close after a failure', async () => {
    const user = userEvent.setup();
    const deps = dependencies();
    Object.assign(deps, {
      closeSidePanel: vi
        .fn()
        .mockRejectedValueOnce(new Error('Close failed.'))
        .mockResolvedValueOnce(undefined),
    });
    render(<SidePanelApp dependencies={deps} />);
    const close = await screen.findByRole('button', {
      name: 'Close side panel',
    });

    await user.click(close);
    expect(await screen.findByRole('alert')).toHaveTextContent('Close failed.');
    await user.click(close);

    expect(deps.closeSidePanel).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('starts a Workflow and opens the focus view in a new tab', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Start workflow: Deep work' }),
    );
    expect(deps.startSession).toHaveBeenCalledWith(workflow.id);
    expect(deps.openFocusView).toHaveBeenCalledOnce();
  });

  test('keeps the compact chooser available after a start failure and allows retry', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-start-retry',
      name: 'Retry rhythm',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([workflow]);
    vi.mocked(deps.startSession)
      .mockRejectedValueOnce(new Error('Session unavailable.'))
      .mockResolvedValueOnce(undefined);
    render(<SidePanelApp dependencies={deps} />);
    const start = await screen.findByRole('button', {
      name: 'Start workflow: Retry rhythm',
    });

    await user.click(start);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Session unavailable.',
    );
    expect(start).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Open Retry rhythm' }),
    ).toBeVisible();

    await user.click(start);
    expect(deps.startSession).toHaveBeenCalledTimes(2);
    expect(deps.openFocusView).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows mirrored controls in the active Session surface', async () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies(
      [workflow],
      createSession('session-1', workflow, Date.now()),
    );
    const { container } = render(<SidePanelApp dependencies={deps} />);

    expect(await screen.findByText('Deep work')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Open focus view' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect(container.querySelector('.side-panel-app')).toHaveAttribute(
      'data-view',
      'session',
    );
  });

  test('keeps active Session content available when Focus navigation fails and retries', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'focus-navigation-retry',
      name: 'Focus navigation retry',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies(
      [workflow],
      createSession('focus-navigation-session', workflow, Date.now()),
    );
    vi.mocked(deps.openFocusView)
      .mockRejectedValueOnce(new Error('Focus unavailable.'))
      .mockResolvedValueOnce(undefined);
    render(<SidePanelApp dependencies={deps} />);
    const openFocus = await screen.findByRole('button', {
      name: 'Open focus view',
    });

    await user.click(openFocus);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Focus unavailable.',
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();

    await user.click(openFocus);
    expect(deps.openFocusView).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('browses Workflows and returns without changing the active Session', async () => {
    const user = userEvent.setup();
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies(
      [workflow],
      createSession('session-1', workflow, Date.now()),
    );
    render(<SidePanelApp dependencies={deps} />);

    await user.click(
      await screen.findByRole('button', { name: 'Back to workflows' }),
    );

    expect(document.querySelector('.side-panel-app')).toHaveAttribute(
      'data-view',
      'workflows',
    );

    expect(
      screen.getByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Active session summary' }),
    ).toBeVisible();
    expect(deps.pauseSession).not.toHaveBeenCalled();
    expect(deps.stopSession).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Return to session' }));

    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  test('does not show the compact bar for a terminal Session', async () => {
    const workflow = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1, environment: {} }],
    });
    const completed = deriveSessionState(
      createSession('session-1', workflow, 1_000),
      3_000,
    );
    render(<SidePanelApp dependencies={dependencies([workflow], completed)} />);

    expect(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Active session summary' }),
    ).not.toBeInTheDocument();
  });

  test('refreshes the visible Workflow list after catalog invalidation', async () => {
    const initial = createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const renamed = createWorkflow({
      id: 'workflow-1',
      name: 'Renamed work',
      phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
    });
    const deps = dependencies([initial]);
    let invalidate: (() => void) | undefined;
    vi.mocked(deps.subscribeWorkflowChanges).mockImplementation((listener) => {
      invalidate = listener;
      return vi.fn();
    });
    vi.spyOn(deps, 'listWorkflows')
      .mockResolvedValueOnce([initial])
      .mockResolvedValueOnce([renamed]);
    render(<SidePanelApp dependencies={deps} />);
    expect(
      await screen.findByRole('button', { name: 'Open Deep work' }),
    ).toBeVisible();

    invalidate?.();

    expect(
      await screen.findByRole('button', { name: 'Open Renamed work' }),
    ).toBeVisible();
  });
});
