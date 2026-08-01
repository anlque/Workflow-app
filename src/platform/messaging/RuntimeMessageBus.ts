import type { SessionChangedMessage, SessionCommand } from './RuntimeMessage';

export type RuntimeMessageBus = {
  onSessionCommand(
    listener: (command: SessionCommand) => Promise<unknown>,
  ): () => void;
  publishSessionChanged(message: SessionChangedMessage): Promise<void>;
};
