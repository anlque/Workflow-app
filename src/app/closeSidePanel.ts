import { browser } from 'wxt/browser';

export async function closeSidePanel(): Promise<void> {
  const currentWindow = await browser.windows.getCurrent();
  if (currentWindow.id === undefined) {
    throw new Error('Current browser window is unavailable.');
  }
  await browser.sidePanel.close({ windowId: currentWindow.id });
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
