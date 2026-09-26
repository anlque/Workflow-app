import { describe, expect, test } from 'vitest';

import type { AlarmScheduler } from '@/platform/alarms';
import type {
  RuntimeMessageBus,
  ActiveSessionRequest,
  SessionChangedMessage,
  SessionCommand,
} from '@/platform/messaging';
import {
  createAsset,
  resolveAssetRoleUseCase,
  type AssetRoleRepository,
} from '@/features/assets';
import {
  createWorkflow,
  resolveWorkflowAssetReferences,
  type Workflow,
  type WorkflowId,
  type WorkflowRepository,
} from '@/features/workflow';
import {
  continueRewardSession,
  createSession,
  deriveSessionState,
  rollSessionReward,
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

function deferred(): Readonly<{
  promise: Promise<void>;
  resolve(): void;
}> {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

class ControlledSessionRepository implements SessionRepository {
  readonly operations: string[] = [];
  readonly #sessions = new Map<SessionId, Session>();
  #saveGate:
    | Readonly<{ started: ReturnType<typeof deferred>; release: Promise<void> }>
    | undefined;
  #activeGate:
    | Readonly<{ started: ReturnType<typeof deferred>; release: Promise<void> }>
    | undefined;

  public blockNextSave(): Readonly<{
    started: Promise<void>;
    release(): void;
  }> {
    const started = deferred();
    const release = deferred();
    this.#saveGate = { started, release: release.promise };
    return { started: started.promise, release: release.resolve };
  }

  public blockNextActiveRead(): Readonly<{
    started: Promise<void>;
    release(): void;
  }> {
    const started = deferred();
    const release = deferred();
    this.#activeGate = { started, release: release.promise };
    return { started: started.promise, release: release.resolve };
  }

  public async getActive(): Promise<Session | null> {
    this.operations.push('getActive');
    const captured =
      [...this.#sessions.values()].find(
        ({ status }) =>
          status === 'running' ||
          status === 'transitioning' ||
          status === 'paused',
      ) ?? null;
    const gate = this.#activeGate;
    if (gate !== undefined) {
      this.#activeGate = undefined;
      gate.started.resolve();
      await gate.release;
    }
    return captured;
  }

  public get(id: SessionId): Promise<Session | null> {
    this.operations.push('get');
    return Promise.resolve(this.#sessions.get(id) ?? null);
  }

  public async save(session: Session): Promise<void> {
    this.operations.push(`save:start:${session.status}`);
    const gate = this.#saveGate;
    if (gate !== undefined) {
      this.#saveGate = undefined;
      gate.started.resolve();
      await gate.release;
    }
    this.#sessions.set(session.id, session);
    this.operations.push(`save:done:${session.status}`);
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

function runningBonusSession(final = false): Session {
  const rewarded = createWorkflow({
    id: final ? 'serialized-final-bonus' : 'serialized-bonus',
    name: 'Serialized Bonus',
    phases: final
      ? [{ type: 'focus', durationSeconds: 10, environment: {} }]
      : [
          { type: 'focus', durationSeconds: 10, environment: {} },
          { type: 'break', durationSeconds: 5, environment: {} },
        ],
    rewardDice: {
      frequency: 1,
      sides: [
        {
          icon: 'a',
          title: 'A',
          bonusPhase: {
            name: 'Bonus',
            durationSeconds: 30,
            environment: {},
          },
        },
        { icon: 'b', title: 'B' },
      ],
    },
  });
  const rewardPaused = deriveSessionState(
    createSession('session-1', rewarded, 1_000),
    12_000,
  );
  return continueRewardSession(
    rollSessionReward(rewardPaused, () => 0, 'roll-serialized'),
    20_000,
    'continue-serialized',
  );
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
    workflowResolver: { resolve: (workflow) => Promise.resolve(workflow) },
  });
  return { value, sessions, clock, messages, alarms, coordinator };
}

async function controlledSetup(final = false) {
  const session = runningBonusSession(final);
  const sessions = new ControlledSessionRepository();
  await sessions.save(session);
  sessions.operations.length = 0;
  const clock = new FakeClock(25_000);
  const messages = new FakeMessageBus();
  const alarms = new FakeAlarmScheduler();
  const coordinator = createSessionCoordinator({
    workflows: workflowRepository(session.snapshot.workflow),
    sessions,
    clock,
    messages,
    alarms,
    createSessionId: () => 'unused-session',
    workflowResolver: { resolve: (workflow) => Promise.resolve(workflow) },
  });
  return { session, sessions, clock, messages, alarms, coordinator };
}

describe('createSessionCoordinator', () => {
  test('composes the real Role resolvers into a direct Session snapshot', async () => {
    const source = createWorkflow({
      id: 'workflow-role',
      name: 'Role workflow',
      phases: [
        {
          type: 'focus',
          durationSeconds: 10,
          environment: { audioAsset: { type: 'role', role: 'Ambient' } },
        },
      ],
    });
    const asset = createAsset({
      id: 'audio-1',
      name: 'Ambient',
      kind: 'audio',
      mimeType: 'audio/mpeg',
      byteSize: 1,
      createdAt: 1,
      role: 'Ambient',
    });
    const assetRoles: AssetRoleRepository = {
      findByRole: () => Promise.resolve(asset),
      moveRole: () => Promise.resolve(),
    };
    const sessions = new InMemorySessionRepository();
    const messages = new FakeMessageBus();
    const coordinator = createSessionCoordinator({
      workflows: workflowRepository(source),
      sessions,
      clock: new FakeClock(1_000),
      messages,
      alarms: new FakeAlarmScheduler(),
      createSessionId: () => 'session-1',
      workflowResolver: {
        resolve: (workflow) =>
          resolveWorkflowAssetReferences(workflow, {
            resolve: (role, kind) =>
              resolveAssetRoleUseCase(assetRoles, role, kind),
          }),
      },
    });
    await coordinator.initialize();

    const session = await messages.dispatch({
      type: 'session/start',
      commandId: 'command-role',
      workflowId: source.id,
    });

    expect(
      (session as Session).snapshot.workflow.phases[0].environment.audioAsset,
    ).toEqual({
      type: 'direct',
      assetId: asset.id,
    });
  });
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
      name: 'locusora.session-phase',
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

  test('does not evict pending commands when the recent cache exceeds its bound', async () => {
    const { value, messages, coordinator } = setup();
    await coordinator.initialize();
    await messages.dispatch({
      type: 'session/start',
      commandId: 'start',
      workflowId: value.id,
    });
    const firstCommand = {
      type: 'session/pause',
      commandId: 'pause-0',
      sessionId: 'session-1',
    } as const;
    const first = messages.dispatch(firstCommand);
    const pending = [
      first,
      ...Array.from({ length: 64 }, (_, index) =>
        messages.dispatch({
          type: 'session/pause',
          commandId: `pause-${String(index + 1)}`,
          sessionId: 'session-1',
        }),
      ),
    ];

    expect(messages.dispatch(firstCommand)).toBe(first);
    await Promise.allSettled(pending);
  });

  test('schedules and publishes both Phase and transition boundaries', async () => {
    const { value, clock, messages, alarms, coordinator } = setup();
    await coordinator.initialize();
    await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: value.id,
    });

    clock.set(11_000);
    await alarms.fire('locusora.session-phase');

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'transitioning',
      currentPhaseIndex: 0,
      transitionEndsAt: 12_000,
    });
    expect(alarms.scheduled).toEqual({
      name: 'locusora.session-phase',
      when: 12_000,
    });

    clock.set(12_000);
    await alarms.fire('locusora.session-phase');

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseEndsAt: 17_000,
    });
    expect(alarms.scheduled).toEqual({
      name: 'locusora.session-phase',
      when: 17_000,
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

    clock.set(18_000);
    await alarms.fire('locusora.session-phase');

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'completed',
      completedAt: 18_000,
    });
    expect(alarms.scheduled).toBeNull();
  });

  test('continues a Reward pause only through the dedicated command', async () => {
    const rewarded = createWorkflow({
      id: 'workflow-rewarded',
      name: 'Rewarded work',
      phases: [
        { type: 'focus', durationSeconds: 10, environment: {} },
        { type: 'break', durationSeconds: 5, environment: {} },
      ],
      rewardDice: {
        frequency: 1,
        rerolls: 1,
        sides: [
          {
            icon: 'tea',
            title: 'Tea',
            bonusPhase: {
              name: 'Tea break',
              durationSeconds: 30,
              environment: {},
            },
          },
          {
            icon: 'walk',
            title: 'Walk',
            bonusPhase: {
              name: 'Walk break',
              durationSeconds: 30,
              environment: {},
            },
          },
        ],
      },
    });
    const sessions = new InMemorySessionRepository();
    const clock = new FakeClock(1_000);
    const messages = new FakeMessageBus();
    const alarms = new FakeAlarmScheduler();
    const coordinator = createSessionCoordinator({
      workflows: workflowRepository(rewarded),
      sessions,
      clock,
      messages,
      alarms,
      createSessionId: () => 'session-1',
      workflowResolver: { resolve: (workflow) => Promise.resolve(workflow) },
    });
    await coordinator.initialize();
    await messages.dispatch({
      type: 'session/start',
      commandId: 'command-1',
      workflowId: rewarded.id,
    });
    clock.set(12_000);
    await alarms.fire('locusora.session-phase');
    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'paused',
      pauseReason: 'reward',
      remainingMilliseconds: 5_000,
    });
    expect(alarms.scheduled).toBeNull();

    await expect(
      messages.dispatch({
        type: 'session/resume',
        commandId: 'command-2',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow();

    clock.set(20_000);
    await messages.dispatch({
      type: 'session/roll-reward',
      commandId: 'command-roll',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
    await expect(
      messages.dispatch({
        type: 'session/reroll-reward',
        commandId: 'command-roll',
        sessionId: 'session-1',
        rewardRitualId: 'session-1:0',
      }),
    ).rejects.toThrow('Command identifier conflicts with an earlier command.');
    await expect(
      messages.dispatch({
        type: 'session/reroll-reward',
        commandId: 'command-roll',
        sessionId: 'another-session',
        rewardRitualId: 'another-session:0',
      }),
    ).rejects.toThrow('Command identifier conflicts with an earlier command.');
    const concurrentRerolls = await Promise.allSettled([
      messages.dispatch({
        type: 'session/reroll-reward',
        commandId: 'command-reroll-1',
        sessionId: 'session-1',
        rewardRitualId: 'session-1:0',
      }),
      messages.dispatch({
        type: 'session/reroll-reward',
        commandId: 'command-reroll-2',
        sessionId: 'session-1',
        rewardRitualId: 'session-1:0',
      }),
    ]);
    expect(concurrentRerolls.map(({ status }) => status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(messages.events.at(-1)?.session).toMatchObject({
      rewardRitual: { rerollsUsed: 1 },
    });
    await messages.dispatch({
      type: 'session/continue-reward',
      commandId: 'command-3',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'running',
      currentPhaseIndex: 1,
      phaseEndsAt: 50_000,
      activeBonusPhase: { rewardRitualId: 'session-1:0' },
    });
    expect(alarms.scheduled).toEqual({
      name: 'locusora.session-phase',
      when: 50_000,
    });
    clock.set(25_000);
    await messages.dispatch({
      type: 'session/restart-phase',
      commandId: 'command-restart',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'running',
      phaseEndsAt: 55_000,
      activeBonusPhase: { rewardRitualId: 'session-1:0' },
    });
    expect(alarms.scheduled).toEqual({
      name: 'locusora.session-phase',
      when: 55_000,
    });
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
      name: 'locusora.session-phase',
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

  test.each([
    ['non-final', 50_000, false],
    ['non-final', 51_000, false],
    ['final', 50_000, true],
    ['final', 51_000, true],
  ] as const)(
    'rejects %s Bonus Restart at %i without hidden writes, then reconciles by alarm',
    async (_kind, now, final) => {
      const { session, sessions, clock, messages, alarms, coordinator } =
        await controlledSetup(final);
      await coordinator.initialize();
      const persistedBefore = await sessions.get(session.id);
      sessions.operations.length = 0;
      const eventCount = messages.events.length;
      clock.set(now);

      await expect(
        messages.dispatch({
          type: 'session/restart-phase',
          commandId: `expired-restart-${String(final)}-${String(now)}`,
          sessionId: session.id,
          rewardRitualId: 'session-1:0',
        }),
      ).rejects.toThrow();

      expect(sessions.operations).toEqual(['get']);
      await expect(sessions.get(session.id)).resolves.toEqual(persistedBefore);
      expect(messages.events).toHaveLength(eventCount);
      expect(alarms.scheduled).toEqual({
        name: 'locusora.session-phase',
        when: 50_000,
      });

      await alarms.fire('locusora.session-phase');
      if (final) {
        await expect(sessions.get(session.id)).resolves.toMatchObject({
          status: 'completed',
          completedAt: 50_000,
        });
        expect(alarms.scheduled).toBeNull();
      } else {
        const reconciled = await sessions.get(session.id);
        expect(reconciled).toMatchObject({
          status: 'running',
          currentPhaseIndex: 1,
          phaseEndsAt: 55_000,
        });
        expect(reconciled?.activeBonusPhase).toBeUndefined();
        expect(alarms.scheduled).toEqual({
          name: 'locusora.session-phase',
          when: 55_000,
        });
      }
      expect(messages.events).toHaveLength(eventCount + 1);
      expect(messages.events.at(-1)?.session).toEqual(
        await sessions.get(session.id),
      );
    },
  );

  test('serializes alarm reconciliation after a pending Bonus Restart', async () => {
    const { sessions, clock, messages, alarms, coordinator } =
      await controlledSetup();
    await coordinator.initialize();
    const baselineReads = sessions.operations.filter(
      (operation) => operation === 'getActive',
    ).length;
    const gate = sessions.blockNextSave();
    const restart = messages.dispatch({
      type: 'session/restart-phase',
      commandId: 'restart-race',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
    await gate.started;
    clock.set(51_000);

    const alarm = alarms.fire('locusora.session-phase');
    expect(
      sessions.operations.filter((operation) => operation === 'getActive'),
    ).toHaveLength(baselineReads);
    gate.release();
    await Promise.all([restart, alarm]);

    await expect(sessions.getActive()).resolves.toMatchObject({
      status: 'running',
      activeBonusPhase: { rewardRitualId: 'session-1:0' },
      phaseEndsAt: 55_000,
    });
  });

  test('serializes alarm reconciliation after a pending Stop', async () => {
    const { session, sessions, clock, messages, alarms, coordinator } =
      await controlledSetup();
    await coordinator.initialize();
    const baselineReads = sessions.operations.filter(
      (operation) => operation === 'getActive',
    ).length;
    const gate = sessions.blockNextSave();
    const stop = messages.dispatch({
      type: 'session/stop',
      commandId: 'stop-race',
      sessionId: 'session-1',
    });
    await gate.started;
    clock.set(51_000);

    const alarm = alarms.fire('locusora.session-phase');
    expect(
      sessions.operations.filter((operation) => operation === 'getActive'),
    ).toHaveLength(baselineReads);
    gate.release();
    await Promise.all([stop, alarm]);

    await expect(sessions.get(session.id)).resolves.toMatchObject({
      status: 'stopped',
    });
  });

  test('serializes active hydration after a pending command', async () => {
    const { sessions, clock, messages, coordinator } = await controlledSetup();
    await coordinator.initialize();
    const baselineReads = sessions.operations.filter(
      (operation) => operation === 'getActive',
    ).length;
    const gate = sessions.blockNextSave();
    const restart = messages.dispatch({
      type: 'session/restart-phase',
      commandId: 'restart-before-hydration',
      sessionId: 'session-1',
      rewardRitualId: 'session-1:0',
    });
    await gate.started;
    clock.set(51_000);

    const hydration = messages.requestActiveSession();
    expect(
      sessions.operations.filter((operation) => operation === 'getActive'),
    ).toHaveLength(baselineReads);
    gate.release();
    await restart;
    await expect(hydration).resolves.toMatchObject({
      status: 'running',
      activeBonusPhase: { rewardRitualId: 'session-1:0' },
      phaseEndsAt: 55_000,
    });
  });

  test('serializes commands after initial reconciliation', async () => {
    const { sessions, messages, coordinator } = await controlledSetup();
    const gate = sessions.blockNextActiveRead();
    const initialization = coordinator.initialize();
    await gate.started;

    const stop = messages.dispatch({
      type: 'session/stop',
      commandId: 'stop-during-initialize',
      sessionId: 'session-1',
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(sessions.operations).not.toContain('save:start:stopped');
    gate.release();
    await Promise.all([initialization, stop]);

    expect(messages.events.at(-1)?.session).toMatchObject({
      status: 'stopped',
    });
  });
});
