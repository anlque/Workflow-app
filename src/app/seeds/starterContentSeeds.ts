import type {
  StarterContentSeedVersion,
  PackagedAssetSeed,
} from '@/features/starter-content';

import { starterAssetSeeds } from './starterAssetSeeds';

const assets: readonly PackagedAssetSeed[] = Object.freeze(
  starterAssetSeeds.map((asset) =>
    Object.freeze({
      ...asset,
      id: `locusora:seed:v1:asset:${asset.key}`,
    }),
  ),
);

export const starterContentSeeds: readonly StarterContentSeedVersion[] =
  Object.freeze([
    Object.freeze({
      version: 1,
      assets,
      workflows: Object.freeze([]),
    }),
  ]);
