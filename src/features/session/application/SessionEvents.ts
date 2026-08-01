import type { Session } from '../domain/Session';

export type SessionChangedEvent = Readonly<{
  type: 'session/changed';
  session: Session | null;
}>;
