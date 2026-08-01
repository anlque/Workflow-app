import { ChromeAlarmScheduler } from '@/platform/alarms';
import { ChromeMessageBus } from '@/platform/messaging';
import { FlowariumDatabase } from '@/platform/storage';
import { assetDatabaseSchemas } from '@/features/assets';
import {
  DexieSessionRepository,
  sessionDatabaseSchemas,
  type Clock,
} from '@/features/session';
import {
  DexieWorkflowRepository,
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
  const database = new FlowariumDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const coordinator = createSessionCoordinator({
    workflows: new DexieWorkflowRepository(database),
    sessions: new DexieSessionRepository(database),
    clock: systemClock,
    messages: new ChromeMessageBus(),
    alarms: new ChromeAlarmScheduler(),
    createSessionId: () => crypto.randomUUID(),
  });
  await coordinator.initialize();
}
