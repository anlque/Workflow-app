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

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { SidePanelDependencies } from './SidePanelApp';

export function createSidePanelDependencies(): SidePanelDependencies {
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

  return {
    sessions,
    startSession: (id) => sessions.start(id),
    pauseSession: (id) => sessions.pause(id),
    resumeSession: (id) => sessions.resume(id),
    stopSession: (id) => sessions.stop(id),
    async openFocusView() {
      await browser.tabs.create({ url: browser.runtime.getURL('/focus.html') });
    },
    listWorkflows: () => listWorkflowsUseCase(workflows),
    async createWorkflow() {
      await createWorkflowUseCase(
        workflows,
        createWorkflow({
          id: crypto.randomUUID(),
          name: 'Untitled Workflow',
          phases: [{ type: 'focus', durationSeconds: 1_500, environment: {} }],
        }),
      );
    },
    async duplicateWorkflow(id) {
      await duplicateWorkflowUseCase(
        workflows,
        id,
        createWorkflowId(crypto.randomUUID()),
      );
    },
    async deleteWorkflow(id) {
      await deleteWorkflowUseCase(workflows, id);
    },
    async reorderWorkflows(ids) {
      await reorderWorkflowsUseCase(workflows, ids);
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
