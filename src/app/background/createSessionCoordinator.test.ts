import { describe, expect, test } from 'vitest';

import type { AlarmScheduler } from '@/platform/alarms';
import type {
  RuntimeMessageBus,
  ActiveSessionRequest,
  SessionChangedMessage,
  SessionCommand,
} from '@/platform/messaging';
import {
  createWorkflow,
  type Workflow,
  type WorkflowId,
  type WorkflowRepository,
} from '@/features/workflow';
import {
  createSession,
  type Clock,
  type Session,
  type SessionId,
  type SessionRepository,
} from '@/features/session';

import { createSessionCoordinator } from './createSessionCoordinator';

class FakeClock implements Clock {
  #now: number;

  public constructor(now: number) {
    this.#now = now;
  }

  public now(): number {
    return this.#now;
  }

  public set(now: number): void {
    this.#now = now;
  }
}

class InMemorySessionRepository implements SessionRepository {
  readonly #sessions = new Map<SessionId, Session>();

  public getActive(): Promise<Session | null> {
    return Promise.resolve(
      [...this.#sessions.values()].find(
        ({ status }) => status === 'running' || status === 'paused',
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

class FakeMessageBus implements RuntimeMessageBus {
  readonly events: SessionChangedMessage[] = [];
  #listener: ((command: SessionCommand) => Promise<unknown>) | undefined;
  #requestListener:
    ((request: ActiveSessionRequest) => Promise<unknown>) | undefined;

  public onSessionCommand(
    listener: (command: SessionCommand) => Promise<unknown>,
  ): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = undefined;
    };
  }

  public publishSessionChanged(message: SessionChangedMessage): Promise<void> {
    this.events.push(message);
    return Promise.resolve();
  }

  public onActiveSessionRequest(
    listener: (request: ActiveSessionRequest) => Promise<unknown>,
  ): () => void {
    this.#requestListener = listener;
    return () => {
      this.#requestListener = undefined;
    };
  }

  public requestActiveSession(): Promise<unknown> {
    if (this.#requestListener === undefined)
      throw new Error('Request listener is not registered.');
    return this.#requestListener({
      type: 'session/get-active',
      requestId: 'request-1',
    });
  }

  public dispatch(command: SessionCommand): Promise<unknown> {
    if (this.#listener === undefined)
      throw new Error('Message listener is not registered.');
    return this.#listener(command);
  }
}

class FakeAlarmScheduler implements AlarmScheduler {
  scheduled: Readonly<{ name: string; when: number }> | null = null;
  #listener: ((name: string) => Promise<void>) | undefined;

  public schedule(name: string, when: number): Promise<void> {
    this.scheduled = { name, when };
    return Promise.resolve();
  }

  public clear(name: string): Promise<void> {
    if (this.scheduled?.name === name) this.scheduled = null;
    return Promise.resolve();
  }

  public onFired(listener: (name: string) => Promise<void>): () => void {
    this.#listener = listener;
    return () => {
      this.#listener = undefined;
    };
  }

  public async fire(name: string): Promise<void> {
    await this.#listener?.(name);
  }
}

function workflow(): Workflow {
  return createWorkflow({
    id: 'workflow-1',
    name: 'Deep work',
    phases: [
      { type: 'focus', durationSeconds: 10, environment: {} },
      { type: 'break', durationSeconds: 5, environment: {} },
    ],
  });
}

function workflowRepository(value: Workflow): WorkflowRepository {
  return {
    list: () => Promise.resolve([value]),
    get: (id: WorkflowId) => Promise.resolve(id === value.id ? value : null),
    save: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    replaceOrder: () => Promise.resolve(),
  };
}

function setup() {
  const value = workflow();
  const sessions = new InMemorySessionRepository();
  const clock = new FakeClock(1_000);
  const messages = new FakeMessageBus();
  const alarms = new FakeAlarmScheduler();
  let nextId = 1;
  const coordinator = createSessionCoordinator({
    workflows: workflowRepository(value),
    sessions,
    clock,
    messages,
    alarms,
    createSessionId: () => `session-${String(nextId++)}`,
  });
  return { value, sessions, clock, messages, alarms, coordinator };
}

describe('createSessionCoordinator', () => {
  test('handles a start command, broadcasts state and schedules the Phase boundary', async () => {
    const { value, messages, alarms, coordinator } = setup();
    await coordinator.initialize();

    const session = await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    });

    expect(session).toMatchObject({ status: 'running', id: 'session-1' });
    expect(messages.events.at(-1)?.session).toEqual(session);
    expect(alarms.scheduled).toEqual({
      name: 'flowarium.session-phase',
      when: 11_000,
    });
  });

  test('handles duplicate commandId only once', async () => {
    const { value, sessions, messages, coordinator } = setup();
    await coordinator.initialize();
    const command = {
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    } as const;

    const first = await messages.dispatch(command);
    const second = await messages.dispatch(command);

    expect(second).toEqual(first);
    await expect(sessions.getActive()).resolves.toEqual(first);
    expect(messages.events).toHaveLength(2);
  });

  test('reconciles a late alarm rather than decrementing time', async () => {
    const { value, clock, messages, alarms, coordinator } = setup();
    await coordinator.initialize();
    await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    });

    clock.set(13_000);
    await alarms.fire('flowarium.session-phase');

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseEndsAt: 16_000,
    });
    expect(alarms.scheduled).toEqual({
      name: 'flowarium.session-phase',
      when: 16_000,
    });
  });

  test('broadcasts the completed Session at the final alarm boundary', async () => {
    const { value, clock, messages, alarms, coordinator } = setup();
    await coordinator.initialize();
    await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    });

    clock.set(16_000);
    await alarms.fire('flowarium.session-phase');

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'completed',
      completedAt: 16_000,
    });
    expect(alarms.scheduled).toBeNull();
  });

  test('restores and broadcasts active state during initialization', async () => {
    const { value, sessions, clock, messages, alarms, coordinator } = setup();
    const existing = createSession('existing', value, 1_000);
    await sessions.save(existing);
    clock.set(3_000);

    await coordinator.initialize();

    expect(messages.events).toEqual([
      { type: 'session/changed', session: existing },
    ]);
    expect(alarms.scheduled).toEqual({
      name: 'flowarium.session-phase',
      when: 11_000,
    });
  });

  test('answers late active Session hydration requests', async () => {
    const { value, messages, coordinator } = setup();
    await coordinator.initialize();
    const session = await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    });

    await expect(messages.requestActiveSession()).resolves.toEqual(session);
  });
});
