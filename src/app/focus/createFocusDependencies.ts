import { browser } from 'wxt/browser';

import {
  ChromeSettingsRepository,
  getSettingsUseCase,
  updateSettingsUseCase,
} from '@/features/settings';
import {
  BrowserAssetUrlService,
  DexieAssetRepository,
} from '@/features/assets';
import {
  DexieWorkflowRepository,
  listWorkflowsUseCase,
} from '@/features/workflow';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { FocusDependencies } from './FocusApp';
import { createUiSoundPlayer } from './createUiSoundPlayer';
import { createSettingsUpdater } from './createSettingsUpdater';
import {
  closeSidePanel,
  openSidePanel,
  subscribeSidePanelState,
} from '../closeSidePanel';
import { createProductionDatabase } from '../databaseSchemas';

export function createFocusDependencies(
  preferences: FocusDependencies['preferences'],
): FocusDependencies {
  const database = createProductionDatabase();
  const assets = new DexieAssetRepository(database);
  const workflows = new DexieWorkflowRepository(database);
  const settings = new ChromeSettingsRepository();
  const urls = new BrowserAssetUrlService();
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
  const updateSettings = createSettingsUpdater({
    load: () => getSettingsUseCase(settings),
    async save(next) {
      await updateSettingsUseCase(settings, next);
    },
  });
  let studioPromise: ReturnType<FocusDependencies['loadStudio']> | undefined;
  return {
    preferences,
    sounds: createUiSoundPlayer(),
    updateSettings,
    closeSidePanel,
    openSidePanel,
    subscribeSidePanelState,
    listWorkflows: () => listWorkflowsUseCase(workflows),
    subscribeWorkflowChanges: (listener) =>
      catalogEvents.subscribeChanged(listener),
    start: (id) => sessions.start(id),
    loadStudio() {
      studioPromise ??=
        import('../workflow-studio/createWorkflowStudioDependencies').then(
          ({ createWorkflowStudioDependencies }) =>
            createWorkflowStudioDependencies(
              preferences,
              database,
              catalogEvents,
            ),
        );
      return studioPromise;
    },
    sessions,
    pause: (id) => sessions.pause(id),
    resume: (id) => sessions.resume(id),
    restartPhase: (id, target) => sessions.restartPhase(id, target),
    restartWorkflow: (id) => sessions.restartWorkflow(id),
    skipPhase: (id, target) => sessions.skipPhase(id, target),
    skipReward: (id, ritualId) => sessions.skipReward(id, ritualId),
    continueReward: (id, ritualId) => sessions.continueReward(id, ritualId),
    rollReward: (id, ritualId) => sessions.rollReward(id, ritualId),
    rerollReward: (id, ritualId) => sessions.rerollReward(id, ritualId),
    stop: (id) => sessions.stop(id),
    async loadAssetUrl(id) {
      const blob = await assets.getBlob(id);
      return blob === null ? null : urls.create(blob);
    },
    releaseAssetUrl(url) {
      urls.revoke(url);
    },
  };
}
