import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Button } from './Button';

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
});
