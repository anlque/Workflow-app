import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  test('provides a labeled single-choice group with keyboard-operable radios', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Theme"
        value="system"
        options={[
          { value: 'system', label: 'System' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
        onChange={onChange}
      />,
    );

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeVisible();
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  test('keeps radio groups independent when labels are repeated', () => {
    const options = [
      { value: 'system', label: 'System' },
      { value: 'light', label: 'Light' },
    ] as const;
    render(
      <>
        <SegmentedControl
          label="Theme"
          value="system"
          options={options}
          onChange={vi.fn()}
        />
        <SegmentedControl
          label="Theme"
          value="light"
          options={options}
          onChange={vi.fn()}
        />
      </>,
    );

    const groups = screen.getAllByRole('radiogroup', { name: 'Theme' });
    const firstGroup = groups[0];
    const secondGroup = groups[1];
    if (firstGroup === undefined || secondGroup === undefined)
      throw new Error('Expected two Theme radio groups.');
    const firstRadios = within(firstGroup).getAllByRole('radio');
    const firstNames = new Set(
      firstRadios.map((radio) => radio.getAttribute('name')),
    );
    const firstRadio = firstRadios[0];
    if (firstRadio === undefined)
      throw new Error('Expected the first Theme radio.');
    const firstName = firstRadio.getAttribute('name');
    const secondName = within(secondGroup)
      .getAllByRole('radio')[0]
      ?.getAttribute('name');
    expect(firstNames).toEqual(new Set([firstName]));
    expect(firstName).not.toBe(secondName);
  });
});
