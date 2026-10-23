import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { WorkflowStudioShell } from './WorkflowStudioShell';

describe('WorkflowStudioShell', () => {
  test('owns the Studio banner, labeled navigation and main landmark', () => {
    render(
      <WorkflowStudioShell
        topBar={<strong>Workflow Studio</strong>}
        navigation={() => <button type="button">Workflows</button>}
      >
        <p>Editor</p>
      </WorkflowStudioShell>,
    );

    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('Workflow Studio');
    expect(banner).not.toHaveClass('app-header');
    expect(
      screen.getByRole('navigation', { name: 'Studio sections' }),
    ).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('Editor');
  });

  test('keeps navigation before content in keyboard order', async () => {
    const user = userEvent.setup();
    render(
      <WorkflowStudioShell
        topBar={<span>Workflow Studio</span>}
        navigation={() => <button type="button">Assets</button>}
      >
        <button type="button">Create workflow</button>
      </WorkflowStudioShell>,
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveFocus();
    await user.tab();
    expect(
      screen.getByRole('button', { name: 'Create workflow' }),
    ).toHaveFocus();
  });

  test('reports horizontal navigation only at the narrow breakpoint', () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(max-width: 52rem)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
    const { unmount } = render(
      <WorkflowStudioShell
        topBar={<span>Workflow Studio</span>}
        navigation={(orientation) => <span>{orientation}</span>}
      >
        Editor
      </WorkflowStudioShell>,
    );

    expect(screen.getByText('horizontal')).toBeVisible();
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
