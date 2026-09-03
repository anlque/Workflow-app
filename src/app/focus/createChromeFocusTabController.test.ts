import { describe, expect, test, vi } from 'vitest';

import { createChromeFocusTabController } from './createChromeFocusTabController';

test('maps Focus Tab operations to the Chrome tabs and windows APIs', async () => {
  const chrome = {
    runtime: {
      getURL: vi.fn(() => 'chrome-extension://test-extension-id/focus.html'),
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([{ id: 7, windowId: 3 }])),
      create: vi.fn(() => Promise.resolve({})),
      update: vi.fn(() => Promise.resolve({})),
    },
    windows: {
      update: vi.fn(() => Promise.resolve({})),
    },
  };

  await createChromeFocusTabController(chrome).openOrActivate();

  expect(chrome.runtime.getURL).toHaveBeenCalledWith('/focus.html');
  expect(chrome.tabs.query).toHaveBeenCalledWith({
    url: 'chrome-extension://test-extension-id/focus.html',
  });
  expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
  expect(chrome.windows.update).toHaveBeenCalledWith(3, { focused: true });
  expect(chrome.tabs.create).not.toHaveBeenCalled();
});

describe('createChromeFocusTabController', () => {
  test('creates the extension Focus URL when no tab exists', async () => {
    const chrome = {
      runtime: {
        getURL: vi.fn(() => 'chrome-extension://test-extension-id/focus.html'),
      },
      tabs: {
        query: vi.fn(() => Promise.resolve([])),
        create: vi.fn(() => Promise.resolve({})),
        update: vi.fn(() => Promise.resolve({})),
      },
      windows: {
        update: vi.fn(() => Promise.resolve({})),
      },
    };

    await createChromeFocusTabController(chrome).openOrActivate();

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/focus.html',
    });
  });
});
