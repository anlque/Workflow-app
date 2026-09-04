import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createFocusDependencies } from './createFocusDependencies';
import { FocusApp } from './FocusApp';
import { createChromeDocumentPreferences } from '../document-preferences/createChromeDocumentPreferences';

export async function bootstrapFocus(
  container: HTMLElement | null,
): Promise<void> {
  if (container === null) {
    throw new Error('Unable to start Locusora: focus root element is missing.');
  }

  const preferences = createChromeDocumentPreferences();
  await preferences.start();
  const dependencies = createFocusDependencies(preferences);
  window.addEventListener(
    'pagehide',
    () => {
      dependencies.sounds.dispose();
      preferences.dispose();
    },
    { once: true },
  );
  createRoot(container).render(
    <StrictMode>
      <FocusApp dependencies={dependencies} />
    </StrictMode>,
  );
}
