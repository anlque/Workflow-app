import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { Button } from './Button';
import { Icon } from '../icon';

describe('Button', () => {
  test('exposes its pending state and prevents interaction', () => {
    render(<Button pending>Save workflow</Button>);

    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  test('defaults to a non-submitting button', () => {
    render(<Button>Move up</Button>);

    expect(screen.getByRole('button', { name: 'Move up' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  test('preserves icon-only accessible name, geometry and focus while pending', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Button aria-label="Open settings" iconOnly>
        <Icon name="settings" />
      </Button>,
    );

    let button = screen.getByRole('button', { name: 'Open settings' });
    expect(button).toHaveClass('button--icon');
    await user.tab();
    expect(button).toHaveFocus();

    rerender(
      <Button aria-label="Open settings" iconOnly pending>
        <Icon name="settings" />
      </Button>,
    );

    button = screen.getByRole('button', { name: 'Open settings' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelectorAll('svg')).toHaveLength(1);
  });
});
