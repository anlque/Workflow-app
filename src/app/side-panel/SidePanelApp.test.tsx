import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { SidePanelApp, type SidePanelDependencies } from './SidePanelApp';

function dependencies(
  workflows: Awaited<ReturnType<SidePanelDependencies['listWorkflows']>> = [],
): SidePanelDependencies {
  return {
    listWorkflows: () => Promise.resolve(workflows),
    createWorkflow: () => Promise.resolve(),
    duplicateWorkflow: () => Promise.resolve(),
    deleteWorkflow: () => Promise.resolve(),
    reorderWorkflows: () => Promise.resolve(),
    openWorkflow: vi.fn(() => Promise.resolve()),
  };
}

describe('SidePanelApp', () => {
  test('shows the compact Workflow empty state', async () => {
    render(<SidePanelApp dependencies={dependencies()} />);
    expect(
      await screen.findByText('Build your first focus rhythm.'),
    ).toBeVisible();
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
});
