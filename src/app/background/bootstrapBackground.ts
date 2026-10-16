import { ChromeAlarmScheduler } from '@/platform/alarms';
import { ChromeMessageBus } from '@/platform/messaging';
import {
  DexieAssetRepository,
  resolveAssetRoleUseCase,
  type AssetImportPolicy,
} from '@/features/assets';
import { DexieSessionRepository, type Clock } from '@/features/session';
import {
  DexieWorkflowRepository,
  resolveWorkflowAssetReferences,
} from '@/features/workflow';
import {
  DexieStarterContentUnitOfWork,
  seedStarterContentUseCase,
  type StarterContentSeedVersion,
} from '@/features/starter-content';

import { createSessionCoordinator } from './createSessionCoordinator';
import type { RunWhenReady } from './createSessionCoordinator';
import {
  registerFocusAction,
  type FocusAction,
} from './createFocusTabController';
import { createChromeFocusTabController } from '../focus/createChromeFocusTabController';
import { createProductionDatabase } from '../databaseSchemas';
import { loadPackagedSeedFile } from '../seeds/loadPackagedSeedFile';
import { starterContentSeeds } from '../seeds/starterContentSeeds';
import { browser } from 'wxt/browser';

const systemClock: Clock = {
  now: () => Date.now(),
};

const starterAssetPolicy: AssetImportPolicy = {
  image: {
    maxBytes: 10 * 1_024 * 1_024,
    mimeTypes: ['image/webp'],
  },
  audio: {
    maxBytes: 50 * 1_024 * 1_024,
    mimeTypes: ['audio/ogg'],
  },
};

type BackgroundInitialization = Readonly<{
  registerListeners(runWhenReady: RunWhenReady): void;
  seeds: readonly StarterContentSeedVersion[];
  seed(seed: StarterContentSeedVersion): Promise<unknown>;
  restoreCoordinator(): Promise<void>;
}>;

export function initializeBackground({
  registerListeners,
  seeds,
  seed,
  restoreCoordinator,
}: BackgroundInitialization): Promise<void> {
  let release = (): void => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const readiness = new Promise<void>((resolve, fail) => {
    release = resolve;
    reject = fail;
  });
  void readiness.catch(() => undefined);
  const runWhenReady: RunWhenReady = (operation) => readiness.then(operation);

  registerListeners(runWhenReady);
  const initialization = (async () => {
    for (const definition of [...seeds].sort(
      (left, right) => left.version - right.version,
    )) {
      await seed(definition);
    }
    await restoreCoordinator();
  })();
  return initialization.then(
    () => {
      release();
    },
    (error: unknown) => {
      reject(error);
      throw error;
    },
  );
}

export async function bootstrapBackground(): Promise<void> {
  const database = createProductionDatabase();
  const starterContent = new DexieStarterContentUnitOfWork(database);
  const focusTabs = createChromeFocusTabController(browser);
  const action: FocusAction = {
    addClickListener(listener) {
      browser.action.onClicked.addListener(listener);
    },
  };
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

  await initializeBackground({
    registerListeners(runWhenReady) {
      registerFocusAction(action, {
        openOrActivate: () => runWhenReady(() => focusTabs.openOrActivate()),
      });
      coordinator.registerListeners(runWhenReady);
    },
    seeds: starterContentSeeds,
    seed: (definition) =>
      seedStarterContentUseCase(
        {
          assetPolicy: starterAssetPolicy,
          files: { load: loadPackagedSeedFile },
          registry: starterContent,
          unitOfWork: starterContent,
          now: () => systemClock.now(),
        },
        definition,
      ),
    restoreCoordinator: () => coordinator.restore(),
  });
}
