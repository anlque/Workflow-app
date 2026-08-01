import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { Dialog } from './Dialog';

describe('Dialog', () => {
  test('labels an open dialog and handles native cancellation', () => {
    const onCancel = vi.fn();
    render(
      <Dialog open title="Delete Deep work?" onCancel={onCancel}>
        <p>This cannot be undone.</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete Deep work?' });
    expect(dialog).toHaveAttribute('open');

    fireEvent(
      dialog,
      new Event('cancel', { bubbles: false, cancelable: true }),
    );
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('does not expose a closed dialog', () => {
    render(
      <Dialog open={false} title="Delete Deep work?" onCancel={() => undefined}>
        <p>This cannot be undone.</p>
      </Dialog>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
