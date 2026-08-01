import type { RuntimeMessageBus } from './RuntimeMessageBus';
import type { SessionChangedMessage, SessionCommand } from './RuntimeMessage';
import {
  parseSessionCommand,
  RuntimeMessageValidationError,
} from './runtimeMessageSchema';

export class ChromeMessageBus implements RuntimeMessageBus {
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
