import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Field } from './Field';

describe('Field', () => {
  test('connects its label, hint and error to the control', () => {
    render(
      <Field
        label="Workflow name"
        hint="Shown in your library."
        error="Name is required."
      >
        <input />
      </Field>,
    );

    const input = screen.getByLabelText('Workflow name');
    expect(input).toHaveAccessibleDescription(
      'Shown in your library. Name is required.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Name is required.')).toHaveAttribute(
      'role',
      'alert',
    );
  });
});
