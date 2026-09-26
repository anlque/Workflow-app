import { useState } from 'react';

import { Button, Dialog } from '@/shared';

import type { Session, SessionId } from '../domain/Session';

export type SessionControlsProps = Readonly<{
  session: Session;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onRestart?(id: SessionId, rewardRitualId: string): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

export function SessionControls({
  session,
  onPause,
  onResume,
  onRestart,
  onStop,
}: SessionControlsProps) {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [pending, setPending] = useState<
    'pause' | 'resume' | 'restart' | 'stop' | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function execute(
    action: 'pause' | 'resume' | 'restart' | 'stop',
    command: (id: SessionId) => Promise<void>,
  ): Promise<boolean> {
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
  const activeBonusPhase = session.activeBonusPhase;

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
          setConfirmingStop(true);
        }}
      >
        Stop
      </Button>
      {activeBonusPhase === undefined || onRestart === undefined ? null : (
        <Button
          variant="quiet"
          onClick={() => {
            setConfirmingRestart(true);
          }}
        >
          Restart phase
        </Button>
      )}
      {error === null ? null : <p role="alert">{error}</p>}
      <Dialog
        open={confirmingRestart}
        title="Restart this Bonus Phase?"
        onCancel={() => {
          setConfirmingRestart(false);
        }}
      >
        <p>Elapsed Bonus progress will be lost.</p>
        <div className="dialog__actions">
          <Button
            onClick={() => {
              setConfirmingRestart(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            pending={pending === 'restart'}
            pendingLabel="Restarting…"
            onClick={() => {
              if (onRestart === undefined || activeBonusPhase === undefined) {
                return;
              }
              void execute('restart', (id) =>
                onRestart(id, activeBonusPhase.rewardRitualId),
              ).then((succeeded) => {
                if (succeeded) setConfirmingRestart(false);
              });
            }}
          >
            Restart phase
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirmingStop}
        title="Stop this session?"
        onCancel={() => {
          setConfirmingStop(false);
        }}
      >
        <p>Your current progress will end here.</p>
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
