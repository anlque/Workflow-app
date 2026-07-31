import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export function bootstrapOptions(container: HTMLElement | null): void {
  if (container === null) {
    throw new Error(
      'Unable to start Flowarium: options root element is missing.',
    );
  }

  createRoot(container).render(
    <StrictMode>
      <main>
        <h1>Flowarium settings</h1>
      </main>
    </StrictMode>,
  );
}
