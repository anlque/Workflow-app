import { browser } from 'wxt/browser';

import {
  assetDatabaseSchemas,
  BrowserAssetUrlService,
  DexieAssetRepository,
} from '@/features/assets';
import { sessionDatabaseSchemas } from '@/features/session';
import {
  DexieWorkflowRepository,
  listWorkflowsUseCase,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import {
  ChromeSessionClient,
  type SessionRuntime,
} from '../session/ChromeSessionClient';
import type { FocusDependencies } from './FocusApp';
import { createUiSoundPlayer } from './createUiSoundPlayer';
import {
  closeSidePanel,
  openSidePanel,
  subscribeSidePanelState,
} from '../closeSidePanel';

export function createFocusDependencies(
  preferences: FocusDependencies['preferences'],
): FocusDependencies {
  const database = new LocusoraDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const assets = new DexieAssetRepository(database);
  const workflows = new DexieWorkflowRepository(database);
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
  return {
    preferences,
    sounds: createUiSoundPlayer(),
    closeSidePanel,
    openSidePanel,
    subscribeSidePanelState,
    listWorkflows: () => listWorkflowsUseCase(workflows),
    subscribeWorkflowChanges: (listener) =>
      catalogEvents.subscribeChanged(listener),
    start: (id) => sessions.start(id),
    openOptions: () => browser.runtime.openOptionsPage(),
    sessions,
    pause: (id) => sessions.pause(id),
    resume: (id) => sessions.resume(id),
    continueReward: (id) => sessions.continueReward(id),
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
