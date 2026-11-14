import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Icon, iconNames } from './Icon';

const expectedIconNames = [
  'arrowDown',
  'chooseFile',
  'dragHandle',
  'addCircle',
  'break',
  'focus',
  'open',
  'plus',
  'appearance',
  'bellOff',
  'bell',
  'checkCircle',
  'check',
  'cloudUpload',
  'close',
  'data',
  'detailed',
  'duplicate',
  'empty',
  'enter',
  'export',
  'file',
  'image',
  'info',
  'lock',
  'monitor',
  'music',
  'pause',
  'play',
  'quick',
  'restartPhase',
  'restartWorkflow',
  'search',
  'settings',
  'skip',
  'sort',
  'soundMuted',
  'sound',
  'stop',
  'stored',
  'tag',
  'trash',
  'tuning',
  'waves',
  'workflowStudio',
  'longBreak',
  'more',
  'playCircle',
  'reward',
  'repeat',
] as const;

describe('Icon', () => {
  test('exposes one semantic name for every approved Figma SVG', () => {
    expect(iconNames).toEqual(expectedIconNames);
  });

  test.each(expectedIconNames)('%s renders one decorative 24px SVG', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');

    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
    expect(svg?.textContent).toBe('');
  });

  test.each(expectedIconNames)(
    '%s normalizes paints and static identifiers for runtime markup',
    (name) => {
      const { container } = render(<Icon name={name} />);
      const markup = container.innerHTML;

      expect(markup).not.toMatch(/#[\da-f]{3,8}|white|black/iu);
      expect(markup).not.toMatch(/\bid=/u);
      expect(markup).not.toMatch(/url\(#/u);
      expect(markup).not.toMatch(/<text\b/iu);
      expect(markup).toContain('currentColor');
    },
  );

  test('preserves the approved overflow geometry for the more action', () => {
    const { container } = render(<Icon name="more" />);

    expect(
      [...container.querySelectorAll('path')].map((path) =>
        path.getAttribute('d'),
      ),
    ).toEqual([
      'M10.5 12C10.5 12.8284 11.1716 13.5 12 13.5C12.8284 13.5 13.5 12.8284 13.5 12C13.5 11.1716 12.8284 10.5 12 10.5C11.1716 10.5 10.5 11.1716 10.5 12Z',
      'M16.5 12C16.5 12.8284 17.1716 13.5 18 13.5C18.8284 13.5 19.5 12.8284 19.5 12C19.5 11.1716 18.8284 10.5 18 10.5C17.1716 10.5 16.5 11.1716 16.5 12Z',
      'M4.5 12C4.5 12.8284 5.17157 13.5 6 13.5C6.82843 13.5 7.5 12.8284 7.5 12C7.5 11.1716 6.82843 10.5 6 10.5C5.17157 10.5 4.5 11.1716 4.5 12Z',
    ]);
  });
});
