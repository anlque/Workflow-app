import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Select } from './Select';

describe('Select', () => {
  test('provides an accessible label and error description', () => {
    render(
      <Select label="Theme" error="Choose a theme." defaultValue="">
        <option value="">Choose</option>
      </Select>,
    );

    const select = screen.getByLabelText('Theme');
    expect(select).toHaveAccessibleDescription('Choose a theme.');
    expect(select).toHaveAttribute('aria-invalid', 'true');
  });
});
