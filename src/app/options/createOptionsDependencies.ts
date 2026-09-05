import {
  assetDatabaseSchemas,
  BrowserAssetUrlService,
  deleteAssetUseCase,
  DexieAssetRepository,
  importAssetUseCase,
  type ActiveSessionAssetReferences,
  type AssetImportPolicy,
  type WorkflowAssetReferences,
} from '@/features/assets';
import {
  ChromeSettingsRepository,
  exportSettingsUseCase,
  getSettingsUseCase,
  importSettingsUseCase,
  updateSettingsUseCase,
} from '@/features/settings';
import {
  activeSessionReferencesAsset,
  DexieSessionRepository,
  sessionDatabaseSchemas,
} from '@/features/session';
import {
  createWorkflowId,
  createWorkflowUseCase,
  deleteWorkflowUseCase,
  DexieWorkflowPackageUnitOfWork,
  DexieWorkflowRepository,
  duplicateWorkflowUseCase,
  exportWorkflowUseCase,
  importWorkflowUseCase,
  listWorkflowsUseCase,
  reorderWorkflowsUseCase,
  updateWorkflowUseCase,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import type { OptionsDependencies } from './OptionsApp';
import { runWorkflowCatalogMutation } from '../runWorkflowCatalogMutation';

const assetPolicy: AssetImportPolicy = {
  image: {
    maxBytes: 10 * 1_024 * 1_024,
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  audio: {
    maxBytes: 50 * 1_024 * 1_024,
    mimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  },
};

const settingsPackageMaxBytes = 1 * 1_024 * 1_024;
const workflowPackageMaxBytes = 100 * 1_024 * 1_024;

function downloadJson(data: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([data], { type: 'application/json;charset=utf-8' }),
  );
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createOptionsDependencies(
  preferences: OptionsDependencies['preferences'],
): OptionsDependencies {
  const database = new LocusoraDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const workflows = new DexieWorkflowRepository(database);
  const assets = new DexieAssetRepository(database);
  const sessions = new DexieSessionRepository(database);
  const settings = new ChromeSettingsRepository();
  const urls = new BrowserAssetUrlService();
  const unitOfWork = new DexieWorkflowPackageUnitOfWork(database);
  const catalogEvents = createChromeWorkflowCatalogEvents();
  const references: WorkflowAssetReferences = {
    async count(assetId) {
      const values = await workflows.list();
      return values.filter((workflow) =>
        workflow.phases.some(
          ({ environment }) =>
            environment.backgroundAssetId === assetId ||
            environment.audioAssetId === assetId,
        ),
      ).length;
    },
  };
  const activeSessionReferences: ActiveSessionAssetReferences = {
    has: (assetId) => activeSessionReferencesAsset(sessions, assetId),
  };

  return {
    preferences,
    async load() {
      const [workflowValues, assetValues, settingsValue] = await Promise.all([
        listWorkflowsUseCase(workflows),
        assets.list(),
        getSettingsUseCase(settings),
      ]);
      return {
        workflows: workflowValues,
        assets: assetValues,
        settings: settingsValue,
      };
    },
    async saveWorkflow(input) {
      await runWorkflowCatalogMutation(async () => {
        const id = createWorkflowId(input.id);
        if ((await workflows.get(id)) === null) {
          await createWorkflowUseCase(workflows, input);
        } else {
          await updateWorkflowUseCase(workflows, input);
        }
      }, catalogEvents);
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
    async importAsset(file, kind) {
      await importAssetUseCase(assets, assetPolicy, {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        blob: file,
        createdAt: Date.now(),
      });
    },
    async deleteAsset(id) {
      await deleteAssetUseCase(assets, activeSessionReferences, references, id);
    },
    loadAssetBlob: (id) => assets.getBlob(id),
    createObjectUrl: (blob) => urls.create(blob),
    revokeObjectUrl: (url) => {
      urls.revoke(url);
    },
    async updateSettings(value) {
      await updateSettingsUseCase(settings, value);
    },
    async exportSettings() {
      downloadJson(
        await exportSettingsUseCase(settings),
        'locusora-settings.json',
      );
    },
    async importSettings(file) {
      await importSettingsUseCase(settings, await file.text(), {
        maxFileBytes: settingsPackageMaxBytes,
      });
    },
    async exportWorkflow(id) {
      if (id === undefined) throw new Error('Select a Workflow to export.');
      const workflow = await workflows.get(id);
      if (workflow === null) throw new Error(`Workflow ${id} was not found.`);
      downloadJson(
        await exportWorkflowUseCase(workflow, assets),
        'locusora-workflow.json',
      );
    },
    async importWorkflow(file) {
      const packageJson = await file.text();
      await runWorkflowCatalogMutation(
        () =>
          importWorkflowUseCase(
            workflows,
            assets,
            unitOfWork,
            packageJson,
            { maxFileBytes: workflowPackageMaxBytes, assetPolicy },
            {
              createWorkflowId: () => crypto.randomUUID(),
              createAssetId: () => crypto.randomUUID(),
              now: () => Date.now(),
            },
          ),
        catalogEvents,
      );
    },
    createId: () => crypto.randomUUID(),
  };
}
