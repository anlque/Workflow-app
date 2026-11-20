import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import { createChromeFocusTabController } from '../focus/createChromeFocusTabController';
import { createWorkflowStudioDependencies } from '../workflow-studio/createWorkflowStudioDependencies';
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
  const focusTabs = createChromeFocusTabController(browser);
  const dependencies = createWorkflowStudioDependencies(preferences);
  window.addEventListener(
    'pagehide',
    () => {
      preferences.dispose();
    },
    { once: true },
  );
  createRoot(container).render(
    <StrictMode>
      <OptionsApp
        dependencies={dependencies}
        onNavigateToFocus={() => focusTabs.openOrActivate()}
      />
    </StrictMode>,
  );
}
