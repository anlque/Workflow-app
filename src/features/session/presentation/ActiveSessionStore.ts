import { createStore, type StoreApi } from 'zustand/vanilla';

import type { Session } from '../domain/Session';

export type ActiveSessionState = Readonly<{
  session: Session | null;
  connection: 'connecting' | 'connected' | 'error';
  error: string | null;
  replace(session: Session | null): void;
  connected(): void;
  failed(message: string): void;
}>;

export type ActiveSessionStore = StoreApi<ActiveSessionState>;

export function createActiveSessionStore(): ActiveSessionStore {
  return createStore<ActiveSessionState>((set) => ({
    session: null,
    connection: 'connecting',
    error: null,
    replace: (session) => {
      set({ session });
    },
    connected: () => {
      set({ connection: 'connected', error: null });
    },
    failed: (message) => {
      set({ connection: 'error', error: message });
    },
  }));
}
