import type { AlarmScheduler } from '@/platform/alarms';
import type { RuntimeMessageBus, SessionCommand } from '@/platform/messaging';
import {
  advanceSessionUseCase,
  continueRewardSessionUseCase,
  getActiveSessionUseCase,
  pauseSessionUseCase,
  resumeSessionUseCase,
  restartSessionPhaseUseCase,
  rollSessionRewardUseCase,
  startSessionUseCase,
  stopSessionUseCase,
  type Clock,
  type Session,
  type SessionRepository,
  type SessionWorkflowResolver,
} from '@/features/session';
import { createWorkflowId, type WorkflowRepository } from '@/features/workflow';

const SESSION_PHASE_ALARM = 'locusora.session-phase';
const MAX_HANDLED_COMMANDS = 64;

export type SessionCoordinatorDependencies = Readonly<{
  workflows: WorkflowRepository;
  sessions: SessionRepository;
  clock: Clock;
  messages: RuntimeMessageBus;
  alarms: AlarmScheduler;
  createSessionId(): string;
  workflowResolver: SessionWorkflowResolver;
  random?: () => number;
}>;

export type SessionCoordinator = Readonly<{
  initialize(): Promise<void>;
}>;

export function createSessionCoordinator({
  workflows,
  sessions,
  clock,
  messages,
  alarms,
  createSessionId,
  workflowResolver,
  random = Math.random,
}: SessionCoordinatorDependencies): SessionCoordinator {
  const handledCommands = new Map<
    string,
    { fingerprint: string; promise: Promise<Session>; settled: boolean }
  >();
  let operationTail: Promise<void> = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = operationTail.then(operation);
    operationTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async function publishAndSchedule(session: Session | null): Promise<void> {
    await messages.publishSessionChanged({ type: 'session/changed', session });
    if (session?.status === 'running') {
      await alarms.schedule(SESSION_PHASE_ALARM, session.phaseEndsAt);
    } else if (session?.status === 'transitioning') {
      await alarms.schedule(SESSION_PHASE_ALARM, session.transitionEndsAt);
    } else {
      await alarms.clear(SESSION_PHASE_ALARM);
    }
  }

  async function execute(command: SessionCommand): Promise<Session> {
    let session: Session;
    if (command.type === 'session/start') {
      const workflow = await workflows.get(
        createWorkflowId(command.workflowId),
      );
      if (workflow === null) {
        throw new Error(`Workflow ${command.workflowId} was not found.`);
      }
      session = await startSessionUseCase(
        sessions,
        clock,
        createSessionId(),
        workflow,
        workflowResolver,
      );
    } else if (command.type === 'session/pause') {
      session = await pauseSessionUseCase(sessions, clock, command.sessionId);
    } else if (command.type === 'session/resume') {
      session = await resumeSessionUseCase(sessions, clock, command.sessionId);
    } else if (command.type === 'session/continue-reward') {
      session = await continueRewardSessionUseCase(
        sessions,
        clock,
        command.sessionId,
        command.commandId,
        command.rewardRitualId,
      );
    } else if (command.type === 'session/restart-phase') {
      session = await restartSessionPhaseUseCase(
        sessions,
        clock,
        command.sessionId,
        command.commandId,
        command.rewardRitualId,
      );
    } else if (
      command.type === 'session/roll-reward' ||
      command.type === 'session/reroll-reward'
    ) {
      session = await rollSessionRewardUseCase(
        sessions,
        command.sessionId,
        random,
        command.type === 'session/reroll-reward',
        command.commandId,
        command.rewardRitualId,
      );
    } else {
      session = await stopSessionUseCase(sessions, clock, command.sessionId);
    }
    await publishAndSchedule(session);
    return session;
  }

  function handle(command: SessionCommand): Promise<Session> {
    const fingerprint = JSON.stringify(command);
    const existing = handledCommands.get(command.commandId);
    if (existing !== undefined) {
      if (existing.fingerprint !== fingerprint) {
        return Promise.reject(
          new Error('Command identifier conflicts with an earlier command.'),
        );
      }
      return existing.promise;
    }
    const pending = enqueue(() => execute(command));
    const entry = { fingerprint, promise: pending, settled: false };
    handledCommands.set(command.commandId, entry);
    const settle = (): void => {
      entry.settled = true;
      while (handledCommands.size > MAX_HANDLED_COMMANDS) {
        const oldestSettled = [...handledCommands].find(
          ([, candidate]) => candidate.settled,
        );
        if (oldestSettled === undefined) break;
        handledCommands.delete(oldestSettled[0]);
      }
    };
    void pending.then(settle, settle);
    return pending;
  }

  async function handleAlarm(name: string): Promise<void> {
    if (name !== SESSION_PHASE_ALARM) return;
    await enqueue(async () => {
      const active = await sessions.getActive();
      const reconciled =
        active?.status === 'running' || active?.status === 'transitioning'
          ? await advanceSessionUseCase(sessions, clock, active.id)
          : active;
      await publishAndSchedule(reconciled);
    });
  }

  return {
    async initialize(): Promise<void> {
      messages.onSessionCommand(handle);
      messages.onActiveSessionRequest(() =>
        enqueue(() => getActiveSessionUseCase(sessions, clock)),
      );
      alarms.onFired(handleAlarm);
      await enqueue(async () => {
        await publishAndSchedule(
          await getActiveSessionUseCase(sessions, clock),
        );
      });
    },
  };
}
