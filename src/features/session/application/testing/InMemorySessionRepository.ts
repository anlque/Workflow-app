import type { Session, SessionId } from '../../domain/Session';
import type { SessionRepository } from '../SessionRepository';

export class InMemorySessionRepository implements SessionRepository {
  readonly #sessions = new Map<SessionId, Session>();

  public getActive(): Promise<Session | null> {
    return Promise.resolve(
      [...this.#sessions.values()].find(
        ({ status }) =>
          status === 'running' ||
          status === 'transitioning' ||
          status === 'paused',
      ) ?? null,
    );
  }

  public get(id: SessionId): Promise<Session | null> {
    return Promise.resolve(this.#sessions.get(id) ?? null);
  }

  public save(session: Session): Promise<void> {
    this.#sessions.set(session.id, session);
    return Promise.resolve();
  }
}
