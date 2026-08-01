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

export class ChromeMessageBus implements RuntimeMessageBus {
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
    browser.runtime.onMessage.addListener(chromeListener);
    return () => {
      browser.runtime.onMessage.removeListener(chromeListener);
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

    browser.runtime.onMessage.addListener(chromeListener);
    return () => {
      browser.runtime.onMessage.removeListener(chromeListener);
    };
  }

  public async publishSessionChanged(
    message: SessionChangedMessage,
  ): Promise<void> {
    await browser.runtime.sendMessage(message);
  }
}
import { browser, type Browser } from 'wxt/browser';
