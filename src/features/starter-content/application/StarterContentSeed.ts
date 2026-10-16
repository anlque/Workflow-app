import type { AssetKind } from '@/features/assets';
import type { CreateWorkflowInput } from '@/features/workflow';

export type PackagedAssetSeed = Readonly<{
  id: string;
  name: string;
  kind: AssetKind;
  role: string;
  mimeType: string;
  path: string;
}>;

export type StarterContentSeedVersion = Readonly<{
  version: number;
  assets: readonly PackagedAssetSeed[];
  workflows: readonly CreateWorkflowInput[];
}>;
