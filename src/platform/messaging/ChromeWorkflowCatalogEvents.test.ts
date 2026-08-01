import { describe, expect, test, vi } from 'vitest';

import { ChromeWorkflowCatalogEvents } from './ChromeWorkflowCatalogEvents';

type MessageListener = (message: unknown) => void;

function createRuntime() {
  const listeners = new Set<MessageListener>();
  return {
    runtime: {
      sendMessage: vi.fn<(message: unknown) => Promise<unknown>>(() =>
        Promise.resolve(undefined),
      ),
      onMessage: {
        addListener(listener: MessageListener) {
          listeners.add(listener);
        },
        removeListener(listener: MessageListener) {
          listeners.delete(listener);
        },
      },
    },
    dispatch(message: unknown) {
      for (const listener of listeners) listener(message);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe('ChromeWorkflowCatalogEvents', () => {
  test('publishes a payload-free catalog invalidation', async () => {
    const fake = createRuntime();
    const events = new ChromeWorkflowCatalogEvents(fake.runtime);

    await events.publishChanged();

    expect(fake.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'workflow/catalog-changed',
    });
  });

  test('delivers only valid catalog invalidations', () => {
    const fake = createRuntime();
    const events = new ChromeWorkflowCatalogEvents(fake.runtime);
    const listener = vi.fn();
    events.subscribeChanged(listener);

    fake.dispatch({ type: 'session/changed', session: null });
    fake.dispatch({ type: 'workflow/catalog-changed', extra: true });
    fake.dispatch({ type: 'workflow/catalog-changed' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('removes the runtime listener when unsubscribed', () => {
    const fake = createRuntime();
    const events = new ChromeWorkflowCatalogEvents(fake.runtime);
    const listener = vi.fn();

    const unsubscribe = events.subscribeChanged(listener);
    expect(fake.listenerCount()).toBe(1);

    unsubscribe();
    fake.dispatch({ type: 'workflow/catalog-changed' });

    expect(fake.listenerCount()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });
});
