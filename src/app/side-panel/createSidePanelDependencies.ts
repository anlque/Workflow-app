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
import type { WorkflowCatalogEvents } from '@/platform/messaging';
import type { LocusoraDatabase } from '@/platform/storage';

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
  database: LocusoraDatabase = createProductionDatabase(),
  catalogEvents: WorkflowCatalogEvents = createChromeWorkflowCatalogEvents(),
): SidePanelDependencies {
  const focusTabs = createChromeFocusTabController(browser);
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
    preferences,
    sessions,
    startSession: (id) => sessions.start(id),
    pauseSession: (id) => sessions.pause(id),
    resumeSession: (id) => sessions.resume(id),
    restartPhase: (id, target) => sessions.restartPhase(id, target),
    restartWorkflow: (id) => sessions.restartWorkflow(id),
    skipPhase: (id, target) => sessions.skipPhase(id, target),
    skipReward: (id, ritualId) => sessions.skipReward(id, ritualId),
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
    async createWorkflow(mode) {
      await runWorkflowCatalogMutation(async () => {
        const created = await createWorkflowUseCase(
          workflows,
          mode === 'quick'
            ? {
                id: crypto.randomUUID(),
                name: 'Untitled Workflow',
                mode: 'quick',
                configuration: {
                  cycleCount: 4,
                  focus: { durationSeconds: 1_500, environment: {} },
                  shortBreak: { durationSeconds: 300, environment: {} },
                },
              }
            : {
                id: crypto.randomUUID(),
                name: 'Untitled Workflow',
                mode: 'detailed',
                phases: [
                  {
                    type: 'focus',
                    durationSeconds: 1_500,
                    environment: {},
                  },
                ],
              },
        );
        const ordered = await listWorkflowsUseCase(workflows);
        const ids = ordered.map(({ id }) => id);
        const createdIndex = ids.indexOf(created.id);
        const firstModeIndex = ordered.findIndex(
          (workflow) =>
            workflow.id !== created.id && workflow.mode === created.mode,
        );
        if (createdIndex >= 0 && firstModeIndex >= 0) {
          ids.splice(createdIndex, 1);
          ids.splice(firstModeIndex, 0, created.id);
          await reorderWorkflowsUseCase(workflows, ids);
        }
      }, catalogEvents);
    },
    async duplicateWorkflow(id) {
      await runWorkflowCatalogMutation(async () => {
        const duplicate = await duplicateWorkflowUseCase(
          workflows,
          id,
          createWorkflowId(crypto.randomUUID()),
        );
        const ordered = await listWorkflowsUseCase(workflows);
        const ids = ordered.map(({ id: value }) => value);
        const duplicateIndex = ids.indexOf(duplicate.id);
        const sourceIndex = ids.indexOf(id);
        if (duplicateIndex >= 0 && sourceIndex >= 0) {
          ids.splice(duplicateIndex, 1);
          ids.splice(sourceIndex + 1, 0, duplicate.id);
          await reorderWorkflowsUseCase(workflows, ids);
        }
      }, catalogEvents);
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
