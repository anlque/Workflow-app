import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { createSession, pauseSession } from '@/features/session';
import { createWorkflow } from '@/features/workflow';

import { CompactActiveSessionBar } from './CompactActiveSessionBar';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep work',
  phases: [
    { type: 'focus', durationSeconds: 60, environment: {} },
    { type: 'break', durationSeconds: 30, environment: {} },
  ],
});

describe('CompactActiveSessionBar', () => {
  test('shows the current Phase and anchor-derived countdown', () => {
    const onReturn = vi.fn();
    render(
      <CompactActiveSessionBar
        session={createSession('session-1', workflow, 1_000)}
        now={() => 11_000}
        onReturn={onReturn}
      />,
    );

    expect(screen.getByText('Deep work')).toBeVisible();
    expect(screen.getByText('Focus')).toBeVisible();
    expect(screen.getByText('00:50')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Return to session' }));
    expect(onReturn).toHaveBeenCalledOnce();
  });

  test('shows fixed remaining time while paused', () => {
    const running = createSession('session-1', workflow, 1_000);
    render(
      <CompactActiveSessionBar
        session={pauseSession(running, 21_000)}
        now={() => 40_000}
        onReturn={() => undefined}
      />,
    );

    expect(screen.getByText('00:40')).toBeVisible();
  });
});
