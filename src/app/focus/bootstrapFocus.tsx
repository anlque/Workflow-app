import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export function bootstrapFocus(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error(
      'Unable to start Flowarium: focus root element is missing.',
    );
  }

  createRoot(container).render(
    <StrictMode>
      <main>
        <h1>Focus session</h1>
      </main>
    </StrictMode>,
  );
}
