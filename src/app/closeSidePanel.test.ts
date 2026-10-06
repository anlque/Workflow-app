import { beforeEach, describe, expect, test, vi } from 'vitest';

type SidePanelEvent = { windowId: number };
type SidePanelListener = (event: SidePanelEvent) => void;

const browserMock = vi.hoisted(() => ({
  windows: {
    getCurrent: vi.fn(),
  },
  sidePanel: {
    close: vi.fn(),
    open: vi.fn(),
    onOpened: {
      addListener: vi.fn<(listener: SidePanelListener) => void>(),
      removeListener: vi.fn<(listener: SidePanelListener) => void>(),
    },
    onClosed: {
      addListener: vi.fn<(listener: SidePanelListener) => void>(),
      removeListener: vi.fn<(listener: SidePanelListener) => void>(),
    },
  },
}));

vi.mock('wxt/browser', () => ({ browser: browserMock }));

import {
  closeSidePanel,
  openSidePanel,
  subscribeSidePanelState,
} from './closeSidePanel';

describe('closeSidePanel', () => {
  beforeEach(() => {
    browserMock.windows.getCurrent.mockReset();
    browserMock.sidePanel.close = vi.fn();
  });

  test('passes the current windowId to the browser close API', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    browserMock.sidePanel.close.mockResolvedValue(undefined);

    await closeSidePanel();

    expect(browserMock.sidePanel.close).toHaveBeenCalledWith({ windowId: 42 });
  });

  test('reports an unavailable current windowId', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({});

    await expect(closeSidePanel()).rejects.toThrow(
      'Current browser window is unavailable.',
    );
    expect(browserMock.sidePanel.close).not.toHaveBeenCalled();
  });

  test('reports an unsupported close API', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    const sidePanel = browserMock.sidePanel as unknown as {
      close?: typeof browserMock.sidePanel.close;
    };
    delete sidePanel.close;

    await expect(closeSidePanel()).rejects.toThrow(
      'Closing the Side Panel is not supported in this browser.',
    );
  });

  test('normalizes a browser close rejection', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    browserMock.sidePanel.close.mockRejectedValue(new Error('Browser failure'));

    await expect(closeSidePanel()).rejects.toThrow(
      'Unable to close the Side Panel. Try again.',
    );
  });
});

describe('openSidePanel', () => {
  beforeEach(() => {
    browserMock.windows.getCurrent.mockReset();
    browserMock.sidePanel.open.mockReset();
  });

  test('passes the current windowId to the browser open API', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    browserMock.sidePanel.open.mockResolvedValue(undefined);

    await openSidePanel();

    expect(browserMock.sidePanel.open).toHaveBeenCalledWith({ windowId: 42 });
  });

  test('normalizes a browser open rejection', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    browserMock.sidePanel.open.mockRejectedValue(new Error('Browser failure'));

    await expect(openSidePanel()).rejects.toThrow(
      'Unable to open the Side Panel. Try again.',
    );
  });
});

describe('subscribeSidePanelState', () => {
  beforeEach(() => {
    browserMock.windows.getCurrent.mockReset();
    browserMock.sidePanel.onOpened.addListener.mockReset();
    browserMock.sidePanel.onOpened.removeListener.mockReset();
    browserMock.sidePanel.onClosed.addListener.mockReset();
    browserMock.sidePanel.onClosed.removeListener.mockReset();
  });

  test('delivers open and close events for the current window', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    const listener = vi.fn();
    const unsubscribe = subscribeSidePanelState(listener);
    const opened =
      browserMock.sidePanel.onOpened.addListener.mock.calls.at(-1)?.[0];
    const closed =
      browserMock.sidePanel.onClosed.addListener.mock.calls.at(-1)?.[0];

    opened?.({ windowId: 42 });
    closed?.({ windowId: 42 });
    await vi.waitFor(() => {
      expect(listener).toHaveBeenNthCalledWith(1, true);
      expect(listener).toHaveBeenNthCalledWith(2, false);
    });

    unsubscribe();
    expect(browserMock.sidePanel.onOpened.removeListener).toHaveBeenCalledWith(
      opened,
    );
    expect(browserMock.sidePanel.onClosed.removeListener).toHaveBeenCalledWith(
      closed,
    );
  });

  test('ignores open and close events for another window', async () => {
    browserMock.windows.getCurrent.mockResolvedValue({ id: 42 });
    const listener = vi.fn();
    subscribeSidePanelState(listener);
    const opened =
      browserMock.sidePanel.onOpened.addListener.mock.calls.at(-1)?.[0];
    const closed =
      browserMock.sidePanel.onClosed.addListener.mock.calls.at(-1)?.[0];

    opened?.({ windowId: 7 });
    closed?.({ windowId: 7 });
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
  });

  test('does not notify after cleanup while current window resolution is pending', async () => {
    let resolveCurrentWindow: ((window: { id: number }) => void) | undefined;
    browserMock.windows.getCurrent.mockReturnValue(
      new Promise((resolve) => {
        resolveCurrentWindow = resolve;
      }),
    );
    const listener = vi.fn();
    const unsubscribe = subscribeSidePanelState(listener);
    const opened =
      browserMock.sidePanel.onOpened.addListener.mock.calls.at(-1)?.[0];

    opened?.({ windowId: 42 });
    unsubscribe();
    resolveCurrentWindow?.({ id: 42 });
    await Promise.resolve();
    await Promise.resolve();

    expect(listener).not.toHaveBeenCalled();
  });
});
