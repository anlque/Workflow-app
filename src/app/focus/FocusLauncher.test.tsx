import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { FocusLauncher } from './FocusLauncher';

const workflow = createWorkflow({
  id: 'workflow-1',
  name: 'Deep Work',
  phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
});

describe('FocusLauncher', () => {
  test('starts a selected Workflow', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => Promise.resolve());
    render(
      <FocusLauncher
        workflows={[workflow]}
        error={null}
        onStart={onStart}
        onOpenStudio={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start Deep Work' }));

    expect(onStart).toHaveBeenCalledWith(workflow.id);
  });

  test('opens Workflow Studio from the empty state', async () => {
    const user = userEvent.setup();
    const onOpenStudio = vi.fn();
    render(
      <FocusLauncher
        workflows={[]}
        error={null}
        onStart={() => Promise.resolve()}
        onOpenStudio={onOpenStudio}
      />,
    );

    expect(screen.getByText('No Workflows yet')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create a Workflow' }));
    expect(onOpenStudio).toHaveBeenCalledOnce();
  });

  test('shows loading and error feedback', () => {
    const { rerender } = render(
      <FocusLauncher
        workflows={null}
        error={null}
        onStart={() => Promise.resolve()}
        onOpenStudio={() => undefined}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading Workflows');

    rerender(
      <FocusLauncher
        workflows={[]}
        error="Workflows unavailable."
        onStart={() => Promise.resolve()}
        onOpenStudio={() => undefined}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Workflows unavailable.',
    );
  });
});
