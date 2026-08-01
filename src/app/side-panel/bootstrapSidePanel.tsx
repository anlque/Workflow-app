import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createSidePanelDependencies } from './createSidePanelDependencies';
import { SidePanelApp } from './SidePanelApp';

export function bootstrapSidePanel(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error(
      'Unable to start Flowarium: side panel root element is missing.',
    );
  }

  const dependencies = createSidePanelDependencies();
  createRoot(container).render(
    <StrictMode>
      <SidePanelApp dependencies={dependencies} />
    </StrictMode>,
  );
}
