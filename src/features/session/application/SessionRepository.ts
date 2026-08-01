import type { Session, SessionId } from '../domain/Session';

export type SessionRepository = {
  getActive(): Promise<Session | null>;
  get(id: SessionId): Promise<Session | null>;
  save(session: Session): Promise<void>;
};
