import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(onUpdate).toHaveBeenCalledWith({ theme: 'dark' });
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  test('drafts multi-step pointer and keyboard changes and commits each interaction once', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <FocusAppearanceControls preferences={preferences} onUpdate={onUpdate} />,
    );
    const blur = screen.getByRole('slider', { name: /^Focus blur/ });
    const brightness = screen.getByRole('slider', {
      name: /^Focus brightness/,
    });

    fireEvent.change(blur, { target: { value: '4' } });
    fireEvent.change(blur, { target: { value: '8' } });
    fireEvent.change(blur, { target: { value: '12' } });
    expect(blur).toHaveValue('12');
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.pointerUp(blur);
    fireEvent.blur(blur);

    brightness.focus();
    fireEvent.keyDown(brightness, { key: 'ArrowRight' });
    fireEvent.change(brightness, { target: { value: '105' } });
    fireEvent.keyDown(brightness, { key: 'ArrowRight' });
    fireEvent.change(brightness, { target: { value: '110' } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    fireEvent.blur(brightness);

    expect(onUpdate).toHaveBeenNthCalledWith(1, {
      backgroundBlurPx: 12,
    });
    expect(onUpdate).toHaveBeenNthCalledWith(2, {
      backgroundBrightnessPercent: 110,
    });
  });

  test('synchronizes drafts and retries a failed commit', async () => {
    const onUpdate = vi
      .fn<(_: { backgroundBlurPx: number }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Storage unavailable.'))
      .mockResolvedValue(undefined);
    const { rerender } = render(
      <FocusAppearanceControls preferences={preferences} onUpdate={onUpdate} />,
    );
    const blur = screen.getByRole('slider', { name: /^Focus blur/ });

    fireEvent.change(blur, { target: { value: '9' } });
    fireEvent.pointerUp(blur);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Storage unavailable.',
    );
    fireEvent.blur(blur);
    expect(onUpdate).toHaveBeenCalledTimes(2);

    rerender(
      <FocusAppearanceControls
        preferences={{ ...preferences, backgroundBlurPx: 15 }}
        onUpdate={onUpdate}
      />,
    );
    expect(blur).toHaveValue('15');
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
