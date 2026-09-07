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
  const currentWindow = await browser.windows.getCurrent();
  if (currentWindow.id === undefined) {
    throw new Error('Current browser window is unavailable.');
  }
  await browser.sidePanel.open({ windowId: currentWindow.id });
}

export function subscribeSidePanelState(
  listener: (open: boolean) => void,
): () => void {
  const opened = (): void => {
    listener(true);
  };
  const closed = (): void => {
    listener(false);
  };
  browser.sidePanel.onOpened.addListener(opened);
  browser.sidePanel.onClosed.addListener(closed);
  return () => {
    browser.sidePanel.onOpened.removeListener(opened);
    browser.sidePanel.onClosed.removeListener(closed);
  };
}
