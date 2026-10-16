import type { RuntimeMessageBus } from './RuntimeMessageBus';
import type {
  ActiveSessionRequest,
  SessionChangedMessage,
  SessionCommand,
} from './RuntimeMessage';
import {
  parseActiveSessionRequest,
  parseSessionCommand,
  RuntimeMessageValidationError,
} from './runtimeMessageSchema';

type ChromeMessageListener = (
  message: unknown,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

type ChromeRuntime = Readonly<{
  onMessage: Readonly<{
    addListener(listener: ChromeMessageListener): void;
    removeListener(listener: ChromeMessageListener): void;
  }>;
  sendMessage(message: unknown): Promise<unknown>;
}>;

function isMissingReceiver(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message ===
      'Could not establish connection. Receiving end does not exist.'
  );
}

export class ChromeMessageBus implements RuntimeMessageBus {
  readonly #runtime: ChromeRuntime;

  public constructor(runtime: ChromeRuntime = browser.runtime) {
    this.#runtime = runtime;
  }

  public onActiveSessionRequest(
    listener: (request: ActiveSessionRequest) => Promise<unknown>,
  ): () => void {
    const chromeListener = (
      message: unknown,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ): boolean | undefined => {
      let request: ActiveSessionRequest;
      try {
        request = parseActiveSessionRequest(message);
      } catch (error) {
        if (error instanceof RuntimeMessageValidationError) return undefined;
        throw error;
      }
      void listener(request).then(
        (result) => {
          sendResponse({ ok: true, result });
        },
        (error: unknown) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'Session request failed.',
          });
        },
      );
      return true;
    };
    this.#runtime.onMessage.addListener(chromeListener);
    return () => {
      this.#runtime.onMessage.removeListener(chromeListener);
    };
  }

  public onSessionCommand(
    listener: (command: SessionCommand) => Promise<unknown>,
  ): () => void {
    const chromeListener = (
      message: unknown,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ): boolean | undefined => {
      let command: SessionCommand;
      try {
        command = parseSessionCommand(message);
      } catch (error) {
        if (error instanceof RuntimeMessageValidationError) return undefined;
        throw error;
      }

      void listener(command).then(
        (result) => {
          sendResponse({ ok: true, result });
        },
        (error: unknown) => {
          sendResponse({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'Session command failed.',
          });
        },
      );
      return true;
    };

    this.#runtime.onMessage.addListener(chromeListener);
    return () => {
      this.#runtime.onMessage.removeListener(chromeListener);
    };
  }

  public async publishSessionChanged(
    message: SessionChangedMessage,
  ): Promise<void> {
    try {
      await this.#runtime.sendMessage(message);
    } catch (error: unknown) {
      if (!isMissingReceiver(error)) throw error;
    }
  }
}
import { browser, type Browser } from 'wxt/browser';
