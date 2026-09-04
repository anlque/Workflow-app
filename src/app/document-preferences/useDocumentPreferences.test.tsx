import { act, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import type {
  DocumentPreferences,
  DocumentPreferencesSnapshot,
} from './DocumentPreferences';
import { useDocumentPreferences } from './useDocumentPreferences';

test('renders live snapshots and unsubscribes on unmount', () => {
  let snapshot: DocumentPreferencesSnapshot = {
    theme: 'light',
    reducedMotion: 'no-preference',
    effectiveReducedMotion: false,
  };
  let listener: (() => void) | undefined;
  const unsubscribe = vi.fn();
  const preferences: DocumentPreferences = {
    start: vi.fn(),
    dispose: vi.fn(),
    getSnapshot: () => snapshot,
    subscribe(next) {
      listener = next;
      return unsubscribe;
    },
  };
  function Probe() {
    const current = useDocumentPreferences(preferences);
    return (
      <output>{`${current.theme}:${String(current.effectiveReducedMotion)}`}</output>
    );
  }

  const view = render(<Probe />);
  expect(screen.getByText('light:false')).toBeInTheDocument();
  act(() => {
    snapshot = {
      theme: 'dark',
      reducedMotion: 'reduce',
      effectiveReducedMotion: true,
    };
    listener?.();
  });
  expect(screen.getByText('dark:true')).toBeInTheDocument();
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
