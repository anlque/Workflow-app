import { useEffect, useRef, useState } from 'react';

import { Button, Dialog } from '@/shared';

import type { Session, SessionId, SessionPhaseTarget } from '../domain/Session';
import { getSkipPhaseConfirmation } from './getSkipPhaseConfirmation';

export type SessionControlsProps = Readonly<{
  session: Session;
  dialogsEnabled?: boolean;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onRestartPhase?(id: SessionId, target: SessionPhaseTarget): Promise<void>;
  onRestartWorkflow?(id: SessionId): Promise<void>;
  onSkipPhase?(id: SessionId, target: SessionPhaseTarget): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

type SkipConfirmationRequest = Readonly<{
  segmentId: string;
  target: SessionPhaseTarget;
  title: string;
  body: string;
}>;

export function SessionControls({
  session,
  dialogsEnabled = true,
  onPause,
  onResume,
  onRestartPhase,
  onRestartWorkflow,
  onSkipPhase,
  onStop,
}: SessionControlsProps) {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [confirmingWorkflowRestart, setConfirmingWorkflowRestart] =
    useState(false);
  const [skipConfirmationRequest, setSkipConfirmationRequest] =
    useState<SkipConfirmationRequest | null>(null);
  const [pending, setPending] = useState<
    'pause' | 'resume' | 'restart' | 'restart-workflow' | 'skip' | 'stop' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const restartPhaseTriggerRef = useRef<HTMLButtonElement>(null);
  const restartWorkflowTriggerRef = useRef<HTMLButtonElement>(null);
  const skipTriggerRef = useRef<HTMLButtonElement>(null);
  const activeBonusPhase = session.activeBonusPhase;
  const segmentId =
    activeBonusPhase === undefined
      ? `phase:${String(session.currentPhaseIndex)}`
      : `bonus:${activeBonusPhase.rewardRitualId}`;
  const skipTarget: SessionPhaseTarget =
    activeBonusPhase === undefined
      ? { type: 'phase', phaseIndex: session.currentPhaseIndex }
      : { type: 'bonus', rewardRitualId: activeBonusPhase.rewardRitualId };
  const skipConfirmation = getSkipPhaseConfirmation(session);

  useEffect(() => {
    if (
      skipConfirmationRequest !== null &&
      skipConfirmationRequest.segmentId !== segmentId
    ) {
      setSkipConfirmationRequest(null);
      setError(null);
      queueMicrotask(() => skipTriggerRef.current?.focus());
    }
  }, [segmentId, skipConfirmationRequest]);

  function closeRestartPhaseDialog(): void {
    setConfirmingRestart(false);
    queueMicrotask(() => restartPhaseTriggerRef.current?.focus());
  }

  function closeRestartWorkflowDialog(): void {
    setConfirmingWorkflowRestart(false);
    queueMicrotask(() => restartWorkflowTriggerRef.current?.focus());
  }

  function closeSkipDialog(): void {
    setSkipConfirmationRequest(null);
    queueMicrotask(() => skipTriggerRef.current?.focus());
  }

  async function execute(
    action:
      'pause' | 'resume' | 'restart' | 'restart-workflow' | 'skip' | 'stop',
    command: (id: SessionId) => Promise<void>,
  ): Promise<boolean> {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPending(action);
    setError(null);
    try {
      await command(session.id);
      if (action === 'stop') setConfirmingStop(false);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Command failed.');
      return false;
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  if (
    session.status === 'completed' ||
    session.status === 'stopped' ||
    session.status === 'transitioning'
  ) {
    return null;
  }

  if (session.status === 'paused' && session.pauseReason === 'reward') {
    return <p className="session-reward-pending">Reward pending</p>;
  }
  return (
    <div className="session-controls">
      {session.status === 'running' ? (
        <Button
          pending={pending === 'pause'}
          pendingLabel="Pausing…"
          onClick={() => {
            void execute('pause', onPause);
          }}
        >
          Pause
        </Button>
      ) : (
        <Button
          variant="primary"
          pending={pending === 'resume'}
          pendingLabel="Resuming…"
          onClick={() => {
            void execute('resume', onResume);
          }}
        >
          Resume
        </Button>
      )}
      <Button
        variant="quiet"
        onClick={() => {
          setError(null);
          setConfirmingStop(true);
        }}
      >
        Stop
      </Button>
      {onSkipPhase === undefined ? null : (
        <Button
          buttonRef={skipTriggerRef}
          variant="quiet"
          pending={pending === 'skip' && skipConfirmationRequest === null}
          pendingLabel="Skipping…"
          onClick={() => {
            setError(null);
            if (skipConfirmation !== null) {
              setSkipConfirmationRequest({
                segmentId,
                target: skipTarget,
                title: skipConfirmation.title,
                body: skipConfirmation.body,
              });
              return;
            }
            void execute('skip', (id) => onSkipPhase(id, skipTarget));
          }}
        >
          Skip phase
        </Button>
      )}
      {onRestartPhase === undefined ? null : (
        <Button
          buttonRef={restartPhaseTriggerRef}
          variant="quiet"
          onClick={() => {
            setError(null);
            setConfirmingRestart(true);
          }}
        >
          Restart phase
        </Button>
      )}
      {onRestartWorkflow === undefined ? null : (
        <Button
          buttonRef={restartWorkflowTriggerRef}
          variant="quiet"
          onClick={() => {
            setError(null);
            setConfirmingWorkflowRestart(true);
          }}
        >
          Restart workflow
        </Button>
      )}
      {error === null ||
      skipConfirmationRequest !== null ||
      confirmingRestart ||
      confirmingWorkflowRestart ||
      confirmingStop ? null : (
        <p role="alert">{error}</p>
      )}
      <Dialog
        open={dialogsEnabled && skipConfirmationRequest !== null}
        title={skipConfirmationRequest?.title ?? 'Skip this phase?'}
        onCancel={() => {
          if (pendingRef.current) return;
          closeSkipDialog();
        }}
      >
        <p>{skipConfirmationRequest?.body}</p>
        {error === null ? null : <p role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button disabled={pending === 'skip'} onClick={closeSkipDialog}>
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending === 'skip'}
            pendingLabel="Skipping…"
            onClick={() => {
              if (onSkipPhase === undefined) return;
              const request = skipConfirmationRequest;
              if (request === null) return;
              void execute('skip', (id) =>
                onSkipPhase(id, request.target),
              ).then((succeeded) => {
                if (succeeded) closeSkipDialog();
              });
            }}
          >
            Skip phase
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialogsEnabled && confirmingRestart}
        title="Restart this phase?"
        onCancel={() => {
          if (pendingRef.current) return;
          closeRestartPhaseDialog();
        }}
      >
        <p>Elapsed progress in this phase will be lost.</p>
        {error === null ? null : <p role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button
            disabled={pending === 'restart'}
            onClick={() => {
              closeRestartPhaseDialog();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending === 'restart'}
            pendingLabel="Restarting…"
            onClick={() => {
              if (onRestartPhase === undefined) return;
              const target: SessionPhaseTarget =
                activeBonusPhase === undefined
                  ? { type: 'phase', phaseIndex: session.currentPhaseIndex }
                  : {
                      type: 'bonus',
                      rewardRitualId: activeBonusPhase.rewardRitualId,
                    };
              void execute('restart', (id) => onRestartPhase(id, target)).then(
                (succeeded) => {
                  if (succeeded) closeRestartPhaseDialog();
                },
              );
            }}
          >
            Restart phase
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialogsEnabled && confirmingWorkflowRestart}
        title="Restart this workflow?"
        onCancel={() => {
          if (pendingRef.current) return;
          closeRestartWorkflowDialog();
        }}
      >
        <p>All Session progress and Reward progress will be lost.</p>
        {error === null ? null : <p role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button
            disabled={pending === 'restart-workflow'}
            onClick={() => {
              closeRestartWorkflowDialog();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending === 'restart-workflow'}
            pendingLabel="Restarting…"
            onClick={() => {
              if (onRestartWorkflow === undefined) return;
              void execute('restart-workflow', onRestartWorkflow).then(
                (succeeded) => {
                  if (succeeded) closeRestartWorkflowDialog();
                },
              );
            }}
          >
            Restart workflow
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={dialogsEnabled && confirmingStop}
        title="Stop this session?"
        onCancel={() => {
          setConfirmingStop(false);
        }}
      >
        <p>Your current progress will end here.</p>
        {error === null ? null : <p role="alert">{error}</p>}
        <div className="dialog__actions">
          <Button
            onClick={() => {
              setConfirmingStop(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending === 'stop'}
            pendingLabel="Stopping…"
            onClick={() => {
              void execute('stop', onStop);
            }}
          >
            Stop session
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
