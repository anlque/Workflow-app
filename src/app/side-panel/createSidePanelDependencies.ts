import { browser } from 'wxt/browser';

import {
  ChromeSettingsRepository,
  getSettingsUseCase,
  updateSettingsUseCase,
} from '@/features/settings';
import {
  createWorkflowId,
  createWorkflowUseCase,
  deleteWorkflowUseCase,
  DexieWorkflowRepository,
  duplicateWorkflowUseCase,
  listWorkflowsUseCase,
  reorderWorkflowsUseCase,
} from '@/features/workflow';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { SidePanelDependencies } from './SidePanelApp';
import { runWorkflowCatalogMutation } from '../runWorkflowCatalogMutation';
import { createChromeFocusTabController } from '../focus/createChromeFocusTabController';
import { closeSidePanel } from '../closeSidePanel';
import { createProductionDatabase } from '../databaseSchemas';

export function createSidePanelDependencies(
  preferences: SidePanelDependencies['preferences'],
): SidePanelDependencies {
  const focusTabs = createChromeFocusTabController(browser);
  const database = createProductionDatabase();
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
    preferences,
    sessions,
    startSession: (id) => sessions.start(id),
    pauseSession: (id) => sessions.pause(id),
    resumeSession: (id) => sessions.resume(id),
    restartPhase: (id, target) => sessions.restartPhase(id, target),
    restartWorkflow: (id) => sessions.restartWorkflow(id),
    rollReward: (id, ritualId) => sessions.rollReward(id, ritualId),
    rerollReward: (id, ritualId) => sessions.rerollReward(id, ritualId),
    continueReward: (id, ritualId) => sessions.continueReward(id, ritualId),
    stopSession: (id) => sessions.stop(id),
    async openFocusView() {
      await focusTabs.openOrActivate();
    },
    closeSidePanel,
    listWorkflows: () => listWorkflowsUseCase(workflows),
    subscribeWorkflowChanges: (listener) =>
      catalogEvents.subscribeChanged(listener),
    async createWorkflow() {
      await runWorkflowCatalogMutation(
        () =>
          createWorkflowUseCase(workflows, {
            id: crypto.randomUUID(),
            name: 'Untitled Workflow',
            phases: [
              { type: 'focus', durationSeconds: 1_500, environment: {} },
            ],
          }),
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
