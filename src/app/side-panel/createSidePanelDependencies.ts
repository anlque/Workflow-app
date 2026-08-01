import { browser } from 'wxt/browser';

import { assetDatabaseSchemas } from '@/features/assets';
import {
  ChromeSettingsRepository,
  getSettingsUseCase,
  updateSettingsUseCase,
} from '@/features/settings';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  createWorkflow,
  createWorkflowId,
  createWorkflowUseCase,
  deleteWorkflowUseCase,
  DexieWorkflowRepository,
  duplicateWorkflowUseCase,
  listWorkflowsUseCase,
  reorderWorkflowsUseCase,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { FlowariumDatabase } from '@/platform/storage';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { SidePanelDependencies } from './SidePanelApp';
import { runWorkflowCatalogMutation } from '../runWorkflowCatalogMutation';
import { createChromeFocusTabController } from '../focus/createChromeFocusTabController';

export function createSidePanelDependencies(): SidePanelDependencies {
  const focusTabs = createChromeFocusTabController(browser);
  const database = new FlowariumDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const workflows = new DexieWorkflowRepository(database);
  const settings = new ChromeSettingsRepository();
  const runtime: SessionRuntime = {
    sendMessage: (message) => browser.runtime.sendMessage(message),
    addMessageListener(listener) {
      browser.runtime.onMessage.addListener(listener);
    },
    removeMessageListener(listener) {
      browser.runtime.onMessage.removeListener(listener);
    },
  };
  const sessions = new ChromeSessionClient(runtime, () => crypto.randomUUID());
  const catalogEvents = createChromeWorkflowCatalogEvents();

  return {
    sessions,
    startSession: (id) => sessions.start(id),
    pauseSession: (id) => sessions.pause(id),
    resumeSession: (id) => sessions.resume(id),
    stopSession: (id) => sessions.stop(id),
    async openFocusView() {
      await focusTabs.openOrActivate();
    },
    listWorkflows: () => listWorkflowsUseCase(workflows),
    subscribeWorkflowChanges: (listener) =>
      catalogEvents.subscribeChanged(listener),
    async createWorkflow() {
      await runWorkflowCatalogMutation(
        () =>
          createWorkflowUseCase(
            workflows,
            createWorkflow({
              id: crypto.randomUUID(),
              name: 'Untitled Workflow',
              phases: [
                { type: 'focus', durationSeconds: 1_500, environment: {} },
              ],
            }),
          ),
        catalogEvents,
      );
    },
    async duplicateWorkflow(id) {
      await runWorkflowCatalogMutation(
        () =>
          duplicateWorkflowUseCase(
            workflows,
            id,
            createWorkflowId(crypto.randomUUID()),
          ),
        catalogEvents,
      );
    },
    async deleteWorkflow(id) {
      await runWorkflowCatalogMutation(
        () => deleteWorkflowUseCase(workflows, id),
        catalogEvents,
      );
    },
    async reorderWorkflows(ids) {
      await runWorkflowCatalogMutation(
        () => reorderWorkflowsUseCase(workflows, ids),
        catalogEvents,
      );
    },
    async openWorkflow(id) {
      const current = await getSettingsUseCase(settings);
      await updateSettingsUseCase(settings, {
        ...current,
        lastSelectedWorkflowId: id,
      });
      await browser.runtime.openOptionsPage();
    },
  };
}
