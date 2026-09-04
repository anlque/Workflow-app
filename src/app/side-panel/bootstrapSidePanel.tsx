import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createSidePanelDependencies } from './createSidePanelDependencies';
import { SidePanelApp } from './SidePanelApp';
import { createChromeDocumentPreferences } from '../document-preferences/createChromeDocumentPreferences';

export async function bootstrapSidePanel(
  container: HTMLElement | null,
): Promise<void> {
  if (container === null) {
    throw new Error(
      'Unable to start Locusora: side panel root element is missing.',
    );
  }

  const preferences = createChromeDocumentPreferences();
  await preferences.start();
  const dependencies = createSidePanelDependencies(preferences);
  window.addEventListener(
    'pagehide',
    () => {
      preferences.dispose();
    },
    { once: true },
  );
  createRoot(container).render(
    <StrictMode>
      <SidePanelApp dependencies={dependencies} />
    </StrictMode>,
  );
}
