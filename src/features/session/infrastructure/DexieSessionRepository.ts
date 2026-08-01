import type { Table } from 'dexie';

import type { FlowariumDatabase } from '@/platform/storage';

import { SessionApplicationError } from '../application/SessionApplicationError';
import type { SessionRepository } from '../application/SessionRepository';
import type { Session, SessionId } from '../domain/Session';
import { mapSessionRecord, mapSessionToRecord } from './mapSessionRecord';
import type { SessionRecord } from './SessionRecord';

export class DexieSessionRepository implements SessionRepository {
  readonly #database: FlowariumDatabase;
  readonly #sessions: Table<SessionRecord, string>;

  public constructor(database: FlowariumDatabase) {
    this.#database = database;
    this.#sessions = database.table<SessionRecord, string>('sessions');
  }

  public async getActive(): Promise<Session | null> {
    const records: unknown[] = await this.#sessions
      .where('active')
      .equals(1)
      .toArray();
    if (records.length > 1) {
      throw new SessionApplicationError('Multiple active Sessions were found.');
    }
    return records[0] === undefined ? null : mapSessionRecord(records[0]);
  }

  public async get(id: SessionId): Promise<Session | null> {
    const value: unknown = await this.#sessions.get(id);
    return value === undefined ? null : mapSessionRecord(value);
  }

  public async save(session: Session): Promise<void> {
    await this.#database.runReadWrite('sessions', async () => {
      if (session.status === 'running' || session.status === 'paused') {
        const active = await this.#sessions.where('active').equals(1).toArray();
        if (active.some(({ id }) => id !== session.id)) {
          throw new SessionApplicationError(
            'An active Session already exists.',
          );
        }
      }
      await this.#sessions.put(mapSessionToRecord(session));
    });
  }
}
