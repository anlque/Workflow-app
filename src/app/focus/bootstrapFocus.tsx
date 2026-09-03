import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createFocusDependencies } from './createFocusDependencies';
import { FocusApp } from './FocusApp';

export function bootstrapFocus(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error('Unable to start Locusora: focus root element is missing.');
  }

  const dependencies = createFocusDependencies();
  window.addEventListener(
    'pagehide',
    () => {
      dependencies.sounds.dispose();
    },
    { once: true },
  );
  createRoot(container).render(
    <StrictMode>
      <FocusApp dependencies={dependencies} />
    </StrictMode>,
  );
}
