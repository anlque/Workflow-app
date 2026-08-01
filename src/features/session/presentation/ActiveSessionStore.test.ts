import { describe, expect, test, vi } from 'vitest';

import { createWorkflow } from '@/features/workflow';

import { createSession } from '../domain/Session';
import { createActiveSessionStore } from './ActiveSessionStore';
import {
  connectSessionMessages,
  type SessionProjectionClient,
} from './connectSessionMessages';

function session(id: string) {
  return createSession(
    id,
    createWorkflow({
      id: 'workflow-1',
      name: 'Deep work',
      phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
    }),
    1_000,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('connectSessionMessages', () => {
  test('hydrates the projection and marks it connected', async () => {
    const value = session('session-1');
    const client: SessionProjectionClient = {
      getActive: () => Promise.resolve(value),
      subscribe: () => vi.fn(),
    };
    const store = createActiveSessionStore();

    const connection = connectSessionMessages(store, client);
    await connection.ready;

    expect(store.getState()).toMatchObject({
      session: value,
      connection: 'connected',
    });
    connection.disconnect();
  });

  test('replaces the projection from events and ignores stale hydration', async () => {
    const hydration = deferred<ReturnType<typeof session> | null>();
    const listener = {
      current: null as
        ((value: ReturnType<typeof session> | null) => void) | null,
    };
    const client: SessionProjectionClient = {
      getActive: () => hydration.promise,
      subscribe: (next) => {
        listener.current = next;
        return vi.fn();
      },
    };
    const store = createActiveSessionStore();
    const connection = connectSessionMessages(store, client);
    const eventValue = session('session-event');

    expect(listener.current).not.toBeNull();
    listener.current?.(eventValue);
    hydration.resolve(session('session-stale'));
    await connection.ready;

    expect(store.getState().session).toEqual(eventValue);
    connection.disconnect();
  });

  test('disconnects the listener and prevents later updates', async () => {
    const listener = {
      current: null as
        ((value: ReturnType<typeof session> | null) => void) | null,
    };
    const unsubscribe = vi.fn();
    const client: SessionProjectionClient = {
      getActive: () => Promise.resolve(null),
      subscribe: (next) => {
        listener.current = next;
        return unsubscribe;
      },
    };
    const store = createActiveSessionStore();
    const connection = connectSessionMessages(store, client);
    await connection.ready;

    connection.disconnect();
    listener.current?.(session('late'));

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(store.getState().session).toBeNull();
  });
});
