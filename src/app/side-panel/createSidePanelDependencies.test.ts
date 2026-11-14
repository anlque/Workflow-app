import 'fake-indexeddb/auto';

import { describe, expect, test, vi } from 'vitest';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(() => Promise.resolve()),
      getURL: vi.fn((path: string) => `chrome-extension://test${path}`),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      openOptionsPage: vi.fn(() => Promise.resolve()),
    },
    tabs: { query: vi.fn(() => Promise.resolve([])), create: vi.fn() },
    windows: { getCurrent: vi.fn(() => Promise.resolve({ id: 1 })) },
    sidePanel: { open: vi.fn(), close: vi.fn() },
    storage: { local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn() } },
  },
}));

import { browser } from 'wxt/browser';

import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import { createSidePanelDependencies } from './createSidePanelDependencies';

describe('createSidePanelDependencies', () => {
  test('opens Workflow Studio without selecting or creating a Workflow', async () => {
    const dependencies = createSidePanelDependencies(
      createTestDocumentPreferences(),
    );

    expect(dependencies).not.toHaveProperty('createWorkflow');
    expect(dependencies).not.toHaveProperty('duplicateWorkflow');
    expect(dependencies).not.toHaveProperty('deleteWorkflow');
    expect(dependencies).not.toHaveProperty('reorderWorkflows');

    await dependencies.openWorkflowStudio();

    expect(browser.runtime.openOptionsPage).toHaveBeenCalledOnce();
  });
});
