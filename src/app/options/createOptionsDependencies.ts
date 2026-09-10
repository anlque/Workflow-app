import {
  assetDatabaseSchemas,
  BrowserAssetUrlService,
  applyAssetRoleChangeUseCase,
  inspectAssetRetirementUseCase,
  inspectAssetRoleChangeUseCase,
  DexieAssetRepository,
  importAssetUseCase,
  retireAssetUseCase,
  type ActiveSessionAssetReferences,
  type AssetImportPolicy,
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
  removeOptionalWorkflowAssetReferences,
  replaceWorkflowAssetReferences,
  renameWorkflowRoleReferences,
  summarizeWorkflowAssetReferences,
  summarizeWorkflowRoleReferences,
  updateWorkflowUseCase,
  workflowDatabaseSchemas,
} from '@/features/workflow';
import { LocusoraDatabase } from '@/platform/storage';
import { createChromeWorkflowCatalogEvents } from '@/platform/messaging';

import type { OptionsDependencies } from './OptionsApp';
import { runWorkflowCatalogMutation } from '../runWorkflowCatalogMutation';
import { DexieAssetRoleManagementUnitOfWork } from './DexieAssetRoleManagementUnitOfWork';
import { DexieAssetRetirementUnitOfWork } from './DexieAssetRetirementUnitOfWork';

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
  database: LocusoraDatabase = new LocusoraDatabase({
    schemas: [
      ...workflowDatabaseSchemas,
      ...sessionDatabaseSchemas,
      ...assetDatabaseSchemas,
    ],
  }),
): OptionsDependencies {
  const workflows = new DexieWorkflowRepository(database);
  const assets = new DexieAssetRepository(database);
  const sessions = new DexieSessionRepository(database);
  const settings = new ChromeSettingsRepository();
  const urls = new BrowserAssetUrlService();
  const unitOfWork = new DexieWorkflowPackageUnitOfWork(database);
  const roleUnitOfWork = new DexieAssetRoleManagementUnitOfWork(database);
  const retirementUnitOfWork = new DexieAssetRetirementUnitOfWork(database);
  const catalogEvents = createChromeWorkflowCatalogEvents();
  const activeSessionReferences: ActiveSessionAssetReferences = {
    has: (assetId) => activeSessionReferencesAsset(sessions, assetId),
  };
  const roleUsage = {
    summarize: (role: Parameters<typeof summarizeWorkflowRoleReferences>[1]) =>
      summarizeWorkflowRoleReferences(workflows, role),
    renameReferences: (
      from: Parameters<typeof renameWorkflowRoleReferences>[1],
      to: Parameters<typeof renameWorkflowRoleReferences>[2],
    ) => renameWorkflowRoleReferences(workflows, from, to),
  };
  const retirementWorkflows = {
    summarize: summarizeWorkflowAssetReferences.bind(null, workflows),
    replace: replaceWorkflowAssetReferences.bind(null, workflows),
    removeOptional: removeOptionalWorkflowAssetReferences.bind(null, workflows),
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
    inspectAssetRetirement: (id) =>
      inspectAssetRetirementUseCase(
        assets,
        activeSessionReferences,
        retirementWorkflows,
        id,
      ),
    async retireAsset(preview, choice) {
      await runWorkflowCatalogMutation(
        () =>
          retireAssetUseCase(
            assets,
            activeSessionReferences,
            retirementWorkflows,
            retirementUnitOfWork,
            assetPolicy,
            preview,
            choice,
          ),
        catalogEvents,
      );
    },
    createAssetRetirementUploadInput(file, kind) {
      return {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        blob: file,
        createdAt: Date.now(),
      };
    },
    inspectAssetRoleChange: (id, value) =>
      inspectAssetRoleChangeUseCase(assets, roleUsage, id, value),
    async applyAssetRoleChange(preview) {
      await runWorkflowCatalogMutation(
        () =>
          applyAssetRoleChangeUseCase(
            assets,
            roleUsage,
            roleUnitOfWork,
            preview,
          ),
        catalogEvents,
      );
    },
    synchronizeAssetRoleChange: () => catalogEvents.publishChanged(),
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
