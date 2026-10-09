import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import { FocusAppearanceControls } from './FocusAppearanceControls';

const preferences = {
  theme: 'system' as const,
  backgroundBlurPx: 0,
  backgroundBrightnessPercent: 100,
};

describe('FocusAppearanceControls', () => {
  test('submits accessible theme and appearance patches', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <FocusAppearanceControls preferences={preferences} onUpdate={onUpdate} />,
    );

    await user.click(screen.getByText('Appearance'));
    await user.selectOptions(screen.getByLabelText('Focus theme'), 'dark');
    await user.click(screen.getByRole('slider', { name: /^Focus blur/ }));

    expect(onUpdate).toHaveBeenCalledWith({ theme: 'dark' });
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  test('shows a recoverable update error', async () => {
    const user = userEvent.setup();
    render(
      <FocusAppearanceControls
        preferences={preferences}
        onUpdate={() => Promise.reject(new Error('Storage unavailable.'))}
      />,
    );
    await user.click(screen.getByText('Appearance'));
    await user.selectOptions(screen.getByLabelText('Focus theme'), 'light');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable.',
    );
  });
});
