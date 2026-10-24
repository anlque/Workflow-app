import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, test, vi } from 'vitest';

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

import { assetDatabaseSchemas } from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  createWorkflow,
  DexieWorkflowRepository,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';
import { createTestDocumentPreferences } from '@/test/createTestDocumentPreferences';

import { createSidePanelDependencies } from './createSidePanelDependencies';

const names: string[] = [];

afterEach(async () => {
  await Promise.all(names.splice(0).map((name) => Dexie.delete(name)));
});

function database(): LocusoraDatabase {
  const name = `side-panel-order-${crypto.randomUUID()}`;
  names.push(name);
  return new LocusoraDatabase({
    name,
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
}

const events = {
  publishChanged: vi.fn(() => Promise.resolve()),
  subscribeChanged: vi.fn(() => vi.fn()),
};

describe('createSidePanelDependencies ordering', () => {
  test('places a new Workflow first in its mode group with a complete permutation', async () => {
    const db = database();
    const repository = new DexieWorkflowRepository(db);
    await repository.save(
      createWorkflow({
        id: 'detailed',
        name: 'Detailed',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
    );
    await repository.save(
      createWorkflow({
        mode: 'quick',
        id: 'quick-old',
        name: 'Old quick',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 60, environment: {} },
          shortBreak: { durationSeconds: 30, environment: {} },
        },
      }),
    );
    const dependencies = createSidePanelDependencies(
      createTestDocumentPreferences(),
      db,
      events,
    );

    await dependencies.createWorkflow('quick');
    const workflows = await dependencies.listWorkflows();

    expect(
      workflows.filter(({ mode }) => mode === 'quick').map(({ name }) => name),
    ).toEqual(['Untitled Workflow', 'Old quick']);
    expect(workflows).toHaveLength(3);
  });

  test('places a Quick duplicate directly after its source in a mixed catalog', async () => {
    const db = database();
    const repository = new DexieWorkflowRepository(db);
    await repository.save(
      createWorkflow({
        mode: 'quick',
        id: 'quick-a',
        name: 'Quick A',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 60, environment: {} },
          shortBreak: { durationSeconds: 30, environment: {} },
        },
      }),
    );
    await repository.save(
      createWorkflow({
        id: 'detailed',
        name: 'Detailed',
        phases: [{ type: 'focus', durationSeconds: 60, environment: {} }],
      }),
    );
    await repository.save(
      createWorkflow({
        mode: 'quick',
        id: 'quick-b',
        name: 'Quick B',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 60, environment: {} },
          shortBreak: { durationSeconds: 30, environment: {} },
        },
      }),
    );
    const dependencies = createSidePanelDependencies(
      createTestDocumentPreferences(),
      db,
      events,
    );

    await dependencies.duplicateWorkflow(
      createWorkflow({
        mode: 'quick',
        id: 'quick-a',
        name: 'Quick A',
        configuration: {
          cycleCount: 2,
          focus: { durationSeconds: 60, environment: {} },
          shortBreak: { durationSeconds: 30, environment: {} },
        },
      }).id,
    );
    const workflows = await dependencies.listWorkflows();

    expect(
      workflows.filter(({ mode }) => mode === 'quick').map(({ name }) => name),
    ).toEqual(['Quick A', 'Quick A', 'Quick B']);
    expect(workflows).toHaveLength(4);
  });
});
