import { beforeEach, describe, expect, test, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  windows: {
    getCurrent: vi.fn(),
  },
  sidePanel: {
    close: vi.fn(),
    open: vi.fn(),
    onOpened: { addListener: vi.fn(), removeListener: vi.fn() },
    onClosed: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('wxt/browser', () => ({ browser: browserMock }));

import { closeSidePanel } from './closeSidePanel';

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
