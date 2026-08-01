import type {
  ActiveSessionRequest,
  SessionChangedMessage,
  SessionCommand,
} from './RuntimeMessage';

export type RuntimeMessageBus = {
  onSessionCommand(
    listener: (command: SessionCommand) => Promise<unknown>,
  ): () => void;
  onActiveSessionRequest(
    listener: (request: ActiveSessionRequest) => Promise<unknown>,
  ): () => void;
  publishSessionChanged(message: SessionChangedMessage): Promise<void>;
};
