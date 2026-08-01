import { useState } from 'react';

import { Button, Dialog } from '@/shared';

import type { Session, SessionId } from '../domain/Session';

export type SessionControlsProps = Readonly<{
  session: Session;
  onPause(id: SessionId): Promise<void>;
  onResume(id: SessionId): Promise<void>;
  onStop(id: SessionId): Promise<void>;
}>;

export function SessionControls({
  session,
  onPause,
  onResume,
  onStop,
}: SessionControlsProps) {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [pending, setPending] = useState<'pause' | 'resume' | 'stop' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function execute(
    action: 'pause' | 'resume' | 'stop',
    command: (id: SessionId) => Promise<void>,
  ): Promise<void> {
    setPending(action);
    setError(null);
    try {
      await command(session.id);
      if (action === 'stop') setConfirmingStop(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Command failed.');
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
    return (
      <p className="session-reward-pending">Reward pending — open focus view</p>
    );
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
          setConfirmingStop(true);
        }}
      >
        Stop
      </Button>
      {error === null ? null : <p role="alert">{error}</p>}
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
