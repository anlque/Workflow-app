import { browser } from 'wxt/browser';

import {
  ChromeSettingsRepository,
  getSettingsUseCase,
  updateSettingsUseCase,
} from '@/features/settings';
import {
  DexieWorkflowRepository,
  listWorkflowsUseCase,
} from '@/features/workflow';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';
import type { WorkflowCatalogEvents } from '@/platform/messaging';
import type { LocusoraDatabase } from '@/platform/storage';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { SidePanelDependencies } from './SidePanelApp';
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
    async openWorkflowStudio() {
      await browser.runtime.openOptionsPage();
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
