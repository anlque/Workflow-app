import { ChromeAlarmScheduler } from '@/platform/alarms';
import { ChromeMessageBus } from '@/platform/messaging';
import { LocusoraDatabase } from '@/platform/storage';
import {
  assetDatabaseSchemas,
  DexieAssetRepository,
  resolveAssetRoleUseCase,
} from '@/features/assets';
import {
  DexieSessionRepository,
  sessionDatabaseSchemas,
  type Clock,
} from '@/features/session';
import {
  DexieWorkflowRepository,
  resolveWorkflowAssetReferences,
  workflowDatabaseSchemas,
} from '@/features/workflow';

import { createSessionCoordinator } from './createSessionCoordinator';
import {
  registerFocusAction,
  type FocusAction,
} from './createFocusTabController';
import { createChromeFocusTabController } from '../focus/createChromeFocusTabController';
import { browser } from 'wxt/browser';

const systemClock: Clock = {
  now: () => Date.now(),
};

export async function bootstrapBackground(): Promise<void> {
  const focusTabs = createChromeFocusTabController(browser);
  const action: FocusAction = {
    addClickListener(listener) {
      browser.action.onClicked.addListener(listener);
    },
  };
  registerFocusAction(action, focusTabs);
  const database = new LocusoraDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const assets = new DexieAssetRepository(database);
  const coordinator = createSessionCoordinator({
    workflows: new DexieWorkflowRepository(database),
    sessions: new DexieSessionRepository(database),
    clock: systemClock,
    messages: new ChromeMessageBus(),
    alarms: new ChromeAlarmScheduler(),
    createSessionId: () => crypto.randomUUID(),
    workflowResolver: {
      resolve: (workflow) =>
        resolveWorkflowAssetReferences(workflow, {
          resolve: (role, expectedKind) =>
            resolveAssetRoleUseCase(assets, role, expectedKind),
        }),
    },
  });
  await coordinator.initialize();
}
