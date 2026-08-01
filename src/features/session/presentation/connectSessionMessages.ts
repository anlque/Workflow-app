import type { Session } from '../domain/Session';
import type { ActiveSessionStore } from './ActiveSessionStore';

export type SessionProjectionClient = Readonly<{
  getActive(): Promise<Session | null>;
  subscribe(listener: (session: Session | null) => void): () => void;
}>;

export type SessionMessageConnection = Readonly<{
  ready: Promise<void>;
  disconnect(): void;
}>;

export function connectSessionMessages(
  store: ActiveSessionStore,
  client: SessionProjectionClient,
): SessionMessageConnection {
  let active = true;
  let receivedEvent = false;
  const unsubscribe = client.subscribe((session) => {
    if (!active) return;
    receivedEvent = true;
    store.getState().replace(session);
    store.getState().connected();
  });
  const ready = client.getActive().then(
    (session) => {
      if (!active) return;
      if (!receivedEvent) store.getState().replace(session);
      store.getState().connected();
    },
    (cause: unknown) => {
      if (!active) return;
      store
        .getState()
        .failed(cause instanceof Error ? cause.message : 'Connection failed.');
    },
  );
  return {
    ready,
    disconnect() {
      if (!active) return;
      active = false;
      unsubscribe();
    },
  };
}
