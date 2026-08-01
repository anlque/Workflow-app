import {
  assetDatabaseSchemas,
  BrowserAssetUrlService,
  deleteAssetUseCase,
  DexieAssetRepository,
  importAssetUseCase,
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
import { sessionDatabaseSchemas } from '@/features/session';
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
import { FlowariumDatabase } from '@/platform/storage';

import type { OptionsDependencies } from './OptionsApp';

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

export function createOptionsDependencies(): OptionsDependencies {
  const database = new FlowariumDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  });
  const workflows = new DexieWorkflowRepository(database);
  const assets = new DexieAssetRepository(database);
  const settings = new ChromeSettingsRepository();
  const urls = new BrowserAssetUrlService();
  const unitOfWork = new DexieWorkflowPackageUnitOfWork(database);
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

  return {
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
      const id = createWorkflowId(input.id);
      if ((await workflows.get(id)) === null) {
        await createWorkflowUseCase(workflows, input);
      } else {
        await updateWorkflowUseCase(workflows, input);
      }
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
      await deleteAssetUseCase(assets, references, id);
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
        'flowarium-settings.json',
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
        'flowarium-workflow.json',
      );
    },
    async importWorkflow(file) {
      await importWorkflowUseCase(
        workflows,
        assets,
        unitOfWork,
        await file.text(),
        { maxFileBytes: workflowPackageMaxBytes, assetPolicy },
        {
          createWorkflowId: () => crypto.randomUUID(),
          createAssetId: () => crypto.randomUUID(),
          now: () => Date.now(),
        },
      );
    },
    createId: () => crypto.randomUUID(),
  };
}
