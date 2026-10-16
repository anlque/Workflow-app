import type { Asset, AssetId, AssetRole } from '@/features/assets';
import type { Workflow, WorkflowId } from '@/features/workflow';

export type StarterContentRegistry = {
  isCompleted(version: number): Promise<boolean>;
};

export type PackagedSeedFileLoader = {
  load(path: string): Promise<Blob>;
};

export type StarterContentTransaction = {
  isCompleted(version: number): Promise<boolean>;
  findAssetById(id: AssetId): Promise<Asset | null>;
  findAssetByRole(role: AssetRole): Promise<Asset | null>;
  findWorkflowById(id: WorkflowId): Promise<Workflow | null>;
  addAsset(asset: Asset, blob: Blob): Promise<void>;
  addWorkflow(workflow: Workflow): Promise<void>;
  complete(version: number, completedAt: number): Promise<void>;
};

export type StarterContentUnitOfWork = {
  run<Result>(
    operation: (transaction: StarterContentTransaction) => Promise<Result>,
  ): Promise<Result>;
};
