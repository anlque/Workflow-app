import type { AssetId } from '@/shared';
import { createAssetRole, type AssetRole } from '@/features/assets';

import { WorkflowValidationError } from './WorkflowErrors';

export type { AssetId } from '@/shared';

export type AssetReference =
  | Readonly<{ type: 'direct'; assetId: AssetId }>
  | Readonly<{ type: 'role'; role: AssetRole }>;

export type AssetReferenceInput =
  | Readonly<{ type: 'direct'; assetId: string }>
  | Readonly<{ type: 'role'; role: string }>;

export type Environment = Readonly<{
  backgroundAsset?: AssetReference;
  audioAsset?: AssetReference;
  backgroundColor?: string;
}>;

export type EnvironmentInput = Readonly<{
  backgroundAsset?: AssetReferenceInput;
  audioAsset?: AssetReferenceInput;
  /** Legacy direct input accepted while direct-only UI callers migrate. */
  backgroundAssetId?: string;
  /** Legacy direct input accepted while direct-only UI callers migrate. */
  audioAssetId?: string;
  backgroundColor?: string;
}>;

function createAssetId(value: string): AssetId {
  if (value.trim().length === 0) {
    throw new WorkflowValidationError('Asset identifier must not be empty.');
  }
  return value as AssetId;
}

function createAssetReference(value: AssetReferenceInput): AssetReference {
  const candidate: Readonly<{
    type?: unknown;
    assetId?: unknown;
    role?: unknown;
  }> = value;
  const keys = Object.keys(value);
  if (
    candidate.type === 'direct' &&
    typeof candidate.assetId === 'string' &&
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('assetId')
  ) {
    return Object.freeze({
      type: 'direct',
      assetId: createAssetId(candidate.assetId),
    });
  }
  if (
    candidate.type === 'role' &&
    typeof candidate.role === 'string' &&
    keys.length === 2 &&
    keys.includes('type') &&
    keys.includes('role')
  ) {
    return Object.freeze({
      type: 'role',
      role: createAssetRole(candidate.role),
    });
  }
  throw new WorkflowValidationError(
    'Asset reference must be direct or role-based.',
  );
}

export function createEnvironment(input: EnvironmentInput): Environment {
  if (
    (input.backgroundAsset !== undefined &&
      input.backgroundAssetId !== undefined) ||
    (input.audioAsset !== undefined && input.audioAssetId !== undefined)
  ) {
    throw new WorkflowValidationError(
      'Environment Asset reference is ambiguous.',
    );
  }
  const backgroundInput =
    input.backgroundAsset ??
    (input.backgroundAssetId === undefined
      ? undefined
      : { type: 'direct' as const, assetId: input.backgroundAssetId });
  const audioInput =
    input.audioAsset ??
    (input.audioAssetId === undefined
      ? undefined
      : { type: 'direct' as const, assetId: input.audioAssetId });
  const backgroundAsset =
    backgroundInput === undefined
      ? undefined
      : createAssetReference(backgroundInput);
  const audioAsset =
    audioInput === undefined ? undefined : createAssetReference(audioInput);

  if (input.backgroundColor?.trim().length === 0) {
    throw new WorkflowValidationError(
      'Environment background color must not be empty.',
    );
  }

  return Object.freeze({
    ...(backgroundAsset === undefined ? {} : { backgroundAsset }),
    ...(audioAsset === undefined ? {} : { audioAsset }),
    ...(input.backgroundColor === undefined
      ? {}
      : { backgroundColor: input.backgroundColor }),
  });
}
