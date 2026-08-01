import type { WorkflowCatalogEvents } from './WorkflowCatalogEvents';
import type { WorkflowCatalogChangedMessage } from './RuntimeMessage';
import {
  parseWorkflowCatalogChangedMessage,
  RuntimeMessageValidationError,
} from './runtimeMessageSchema';

type MessageListener = (message: unknown) => void;

export type WorkflowCatalogRuntime = Readonly<{
  sendMessage(message: WorkflowCatalogChangedMessage): Promise<unknown>;
  onMessage: Readonly<{
    addListener(listener: MessageListener): void;
    removeListener(listener: MessageListener): void;
  }>;
}>;

export class ChromeWorkflowCatalogEvents implements WorkflowCatalogEvents {
  readonly #runtime: WorkflowCatalogRuntime;

  public constructor(runtime: WorkflowCatalogRuntime) {
    this.#runtime = runtime;
  }

  public async publishChanged(): Promise<void> {
    await this.#runtime.sendMessage({ type: 'workflow/catalog-changed' });
  }

  public subscribeChanged(listener: () => void): () => void {
    const runtimeListener: MessageListener = (message) => {
      try {
        parseWorkflowCatalogChangedMessage(message);
      } catch (error) {
        if (error instanceof RuntimeMessageValidationError) return;
        throw error;
      }
      listener();
    };
    this.#runtime.onMessage.addListener(runtimeListener);
    return () => {
      this.#runtime.onMessage.removeListener(runtimeListener);
    };
  }
}

export function createChromeWorkflowCatalogEvents(): WorkflowCatalogEvents {
  return new ChromeWorkflowCatalogEvents({
    sendMessage: (message) => browser.runtime.sendMessage(message),
    onMessage: {
      addListener(listener) {
        browser.runtime.onMessage.addListener(listener);
      },
      removeListener(listener) {
        browser.runtime.onMessage.removeListener(listener);
      },
    },
  });
}
import { browser } from 'wxt/browser';
