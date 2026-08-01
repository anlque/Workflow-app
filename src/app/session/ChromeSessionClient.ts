import type {
  Session,
  SessionId,
  SessionProjectionClient,
} from '@/features/session';
import { parseSessionProjection } from '@/features/session';
import type { SessionCommand } from '@/platform/messaging';
import type { WorkflowId } from '@/features/workflow';

export type SessionRuntime = Readonly<{
  sendMessage(message: unknown): Promise<unknown>;
  addMessageListener(listener: (message: unknown) => void): void;
  removeMessageListener(listener: (message: unknown) => void): void;
}>;

function result(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Background returned an invalid response.');
  }
  const response = value as Readonly<Record<string, unknown>>;
  if (response['ok'] === true) return response['result'];
  if (response['ok'] === false && typeof response['error'] === 'string') {
    throw new Error(response['error']);
  }
  throw new Error('Background returned an invalid response.');
}

export class ChromeSessionClient implements SessionProjectionClient {
  readonly #runtime: SessionRuntime;
  readonly #createId: () => string;

  public constructor(runtime: SessionRuntime, createId: () => string) {
    this.#runtime = runtime;
    this.#createId = createId;
  }

  public async getActive(): Promise<Session | null> {
    return parseSessionProjection(
      result(
        await this.#runtime.sendMessage({
          type: 'session/get-active',
          requestId: this.#createId(),
        }),
      ),
    );
  }

  public subscribe(listener: (session: Session | null) => void): () => void {
    const runtimeListener = (message: unknown): void => {
      if (
        typeof message !== 'object' ||
        message === null ||
        Array.isArray(message)
      ) {
        return;
      }
      const event = message as Readonly<Record<string, unknown>>;
      if (event['type'] !== 'session/changed') return;
      try {
        listener(parseSessionProjection(event['session']));
      } catch {
        return;
      }
    };
    this.#runtime.addMessageListener(runtimeListener);
    return () => {
      this.#runtime.removeMessageListener(runtimeListener);
    };
  }

  public pause(id: SessionId): Promise<void> {
    return this.#command({
      type: 'session/pause',
      commandId: this.#createId(),
      sessionId: id,
    });
  }

  public start(id: WorkflowId): Promise<void> {
    return this.#command({
      type: 'session/start',
      commandId: this.#createId(),
      workflowId: id,
    });
  }

  public resume(id: SessionId): Promise<void> {
    return this.#command({
      type: 'session/resume',
      commandId: this.#createId(),
      sessionId: id,
    });
  }

  public stop(id: SessionId): Promise<void> {
    return this.#command({
      type: 'session/stop',
      commandId: this.#createId(),
      sessionId: id,
    });
  }

  async #command(command: SessionCommand): Promise<void> {
    parseSessionProjection(result(await this.#runtime.sendMessage(command)));
  }
}
