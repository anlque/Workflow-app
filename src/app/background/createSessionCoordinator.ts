import type { AlarmScheduler } from '@/platform/alarms';
import type { RuntimeMessageBus, SessionCommand } from '@/platform/messaging';
import {
  advanceSessionUseCase,
  getActiveSessionUseCase,
  pauseSessionUseCase,
  resumeSessionUseCase,
  startSessionUseCase,
  stopSessionUseCase,
  type Clock,
  type Session,
  type SessionRepository,
} from '@/features/session';
import { createWorkflowId, type WorkflowRepository } from '@/features/workflow';

const SESSION_PHASE_ALARM = 'flowarium.session-phase';

export type SessionCoordinatorDependencies = Readonly<{
  workflows: WorkflowRepository;
  sessions: SessionRepository;
  clock: Clock;
  messages: RuntimeMessageBus;
  alarms: AlarmScheduler;
  createSessionId(): string;
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
}: SessionCoordinatorDependencies): SessionCoordinator {
  const handledCommands = new Map<string, Promise<Session>>();

  async function publishAndSchedule(session: Session | null): Promise<void> {
    await messages.publishSessionChanged({ type: 'session/changed', session });
    if (session?.status === 'running') {
      await alarms.schedule(SESSION_PHASE_ALARM, session.phaseEndsAt);
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
      );
    } else if (command.type === 'session/pause') {
      session = await pauseSessionUseCase(sessions, clock, command.sessionId);
    } else if (command.type === 'session/resume') {
      session = await resumeSessionUseCase(sessions, clock, command.sessionId);
    } else {
      session = await stopSessionUseCase(sessions, clock, command.sessionId);
    }
    await publishAndSchedule(session);
    return session;
  }

  function handle(command: SessionCommand): Promise<Session> {
    const existing = handledCommands.get(command.commandId);
    if (existing !== undefined) return existing;
    const pending = execute(command);
    handledCommands.set(command.commandId, pending);
    return pending;
  }

  async function handleAlarm(name: string): Promise<void> {
    if (name !== SESSION_PHASE_ALARM) return;
    const active = await getActiveSessionUseCase(sessions, clock);
    const reconciled =
      active?.status === 'running'
        ? await advanceSessionUseCase(sessions, clock, active.id)
        : active;
    await publishAndSchedule(reconciled);
  }

  return {
    async initialize(): Promise<void> {
      messages.onSessionCommand(handle);
      messages.onActiveSessionRequest(() =>
        getActiveSessionUseCase(sessions, clock),
      );
      alarms.onFired(handleAlarm);
      await publishAndSchedule(await getActiveSessionUseCase(sessions, clock));
    },
  };
}
