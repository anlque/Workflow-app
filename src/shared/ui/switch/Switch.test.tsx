import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { Switch } from './Switch';

describe('Switch', () => {
  test('keeps native checkbox semantics and exposes supporting copy', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        label="Music on"
        description="Ambient tracks during phases."
        checked
        onChange={onChange}
      />,
    );

    const control = screen.getByRole('checkbox', { name: 'Music on' });
    expect(control).toBeChecked();
    expect(screen.getByText('Ambient tracks during phases.')).toBeVisible();
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('can show compact state copy without changing the accessible name', () => {
    render(
      <Switch
        label="Mute cues with music"
        displayLabel="Off"
        checked={false}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Mute cues with music' }),
    ).not.toBeChecked();
    expect(screen.getByText('Off')).toBeVisible();
  });
});
