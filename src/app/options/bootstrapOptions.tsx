import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createOptionsDependencies } from './createOptionsDependencies';
import { OptionsApp } from './OptionsApp';

export function bootstrapOptions(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error(
      'Unable to start Flowarium: options root element is missing.',
    );
  }

  const dependencies = createOptionsDependencies();
  createRoot(container).render(
    <StrictMode>
      <OptionsApp dependencies={dependencies} />
    </StrictMode>,
  );
}
