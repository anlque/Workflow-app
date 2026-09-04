import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createOptionsDependencies } from './createOptionsDependencies';
import { OptionsApp } from './OptionsApp';
import { createChromeDocumentPreferences } from '../document-preferences/createChromeDocumentPreferences';

export async function bootstrapOptions(
  container: HTMLElement | null,
): Promise<void> {
  if (container === null) {
    throw new Error(
      'Unable to start Locusora: options root element is missing.',
    );
  }

  const preferences = createChromeDocumentPreferences();
  await preferences.start();
  const dependencies = createOptionsDependencies(preferences);
  window.addEventListener(
    'pagehide',
    () => {
      preferences.dispose();
    },
    { once: true },
  );
  createRoot(container).render(
    <StrictMode>
      <OptionsApp dependencies={dependencies} />
    </StrictMode>,
  );
}
