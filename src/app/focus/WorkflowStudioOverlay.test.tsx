import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { createSession } from '@/features/session';
import { createWorkflow } from '@/features/workflow';
import { Dialog } from '@/shared';

import { WorkflowStudioOverlay } from './WorkflowStudioOverlay';

function session() {
  return createSession(
    'overlay-session',
    createWorkflow({
      id: 'overlay-workflow',
      name: 'Overlay focus',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    }),
    1_000,
  );
}

describe('WorkflowStudioOverlay', () => {
  test('is inert while closed and focuses Close when opened', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <WorkflowStudioOverlay
        open={false}
        reducedMotion={false}
        session={null}
        onClose={onClose}
      >
        <button type="button">Studio action</button>
      </WorkflowStudioOverlay>,
    );

    const overlay = container.querySelector('.workflow-studio-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute('inert');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');

    rerender(
      <WorkflowStudioOverlay
        open
        reducedMotion={false}
        session={null}
        onClose={onClose}
      >
        <button type="button">Studio action</button>
      </WorkflowStudioOverlay>,
    );
    expect(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    ).toHaveFocus();
    expect(overlay).not.toHaveAttribute('inert');
    expect(overlay).toHaveAttribute('data-reduced-motion', 'false');
  });

  test('closes on Escape and keeps the active Session summary read-only', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <WorkflowStudioOverlay
        open
        reducedMotion
        session={session()}
        onClose={onClose}
      >
        <p>Studio content</p>
      </WorkflowStudioOverlay>,
    );

    expect(screen.getByLabelText('Active session summary')).toHaveTextContent(
      'Overlay focus',
    );
    expect(
      screen.queryByRole('button', { name: /pause|resume|stop/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Workflow Studio' }),
    ).toHaveAttribute('data-reduced-motion', 'true');

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  test('leaves Escape from a nested Studio dialog to that dialog', () => {
    const onClose = vi.fn();
    const onDialogCancel = vi.fn();
    render(
      <WorkflowStudioOverlay
        open
        reducedMotion={false}
        session={null}
        onClose={onClose}
      >
        <Dialog open title="Nested dialog" onCancel={onDialogCancel}>
          <button type="button">Nested action</button>
        </Dialog>
      </WorkflowStudioOverlay>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Nested dialog' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Nested action' }), {
      key: 'Escape',
    });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onDialogCancel).toHaveBeenCalledOnce();
  });

  test('keeps Close available when Studio content fails', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const Broken = () => {
      throw new Error('Studio chunk failed.');
    };

    render(
      <WorkflowStudioOverlay
        open
        reducedMotion={false}
        session={null}
        onClose={onClose}
      >
        <Broken />
      </WorkflowStudioOverlay>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Studio chunk failed.');
    await user.click(
      screen.getByRole('button', { name: 'Close Workflow Studio' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
