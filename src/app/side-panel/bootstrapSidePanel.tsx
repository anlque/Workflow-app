import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export function bootstrapSidePanel(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error(
      'Unable to start Flowarium: side panel root element is missing.',
    );
  }

  createRoot(container).render(
    <StrictMode>
      <main>
        <h1>Flowarium</h1>
        <p>Your Workflow Library will appear here.</p>
      </main>
    </StrictMode>,
  );
}
