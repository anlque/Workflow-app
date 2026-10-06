import { browser } from 'wxt/browser';

export async function closeSidePanel(): Promise<void> {
  let currentWindow: { id?: number | undefined };
  try {
    currentWindow = await browser.windows.getCurrent();
  } catch (cause) {
    throw new Error('Unable to close the Side Panel. Try again.', { cause });
  }
  if (currentWindow.id === undefined) {
    throw new Error('Current browser window is unavailable.');
  }
  const close = (
    browser.sidePanel as unknown as {
      close?: (options: { windowId: number }) => Promise<void>;
    }
  ).close;
  if (typeof close !== 'function') {
    throw new Error('Closing the Side Panel is not supported in this browser.');
  }
  try {
    await close({ windowId: currentWindow.id });
  } catch (cause) {
    throw new Error('Unable to close the Side Panel. Try again.', { cause });
  }
}

export async function openSidePanel(): Promise<void> {
  let currentWindow: { id?: number | undefined };
  try {
    currentWindow = await browser.windows.getCurrent();
  } catch (cause) {
    throw new Error('Unable to open the Side Panel. Try again.', { cause });
  }
  if (currentWindow.id === undefined) {
    throw new Error('Current browser window is unavailable.');
  }
  try {
    await browser.sidePanel.open({ windowId: currentWindow.id });
  } catch (cause) {
    throw new Error('Unable to open the Side Panel. Try again.', { cause });
  }
}

export function subscribeSidePanelState(
  listener: (open: boolean) => void,
): () => void {
  let active = true;
  const currentWindowId = browser.windows
    .getCurrent()
    .then((currentWindow) => currentWindow.id)
    .catch(() => undefined);
  const notifyIfCurrentWindow = (
    open: boolean,
    event: { windowId: number },
  ): void => {
    void currentWindowId.then((windowId) => {
      if (active && windowId !== undefined && event.windowId === windowId) {
        listener(open);
      }
    });
  };
  const opened = (event: { windowId: number }): void => {
    notifyIfCurrentWindow(true, event);
  };
  const closed = (event: { windowId: number }): void => {
    notifyIfCurrentWindow(false, event);
  };
  browser.sidePanel.onOpened.addListener(opened);
  browser.sidePanel.onClosed.addListener(closed);
  return () => {
    active = false;
    browser.sidePanel.onOpened.removeListener(opened);
    browser.sidePanel.onClosed.removeListener(closed);
  };
}
