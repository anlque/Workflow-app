import { describe, expect, test, vi } from 'vitest';

import { assetRoleKey, createAssetRole } from '@/features/assets';

import { loadPackagedSeedFile } from './loadPackagedSeedFile';
import { starterContentSeeds } from './starterContentSeeds';

describe('starterContentSeeds', () => {
  test('defines unique immutable Asset-only v1 and Workflow-only v2 batches', () => {
    expect(starterContentSeeds.map(({ version }) => version)).toEqual([1, 2]);
    const assetVersion = starterContentSeeds[0];
    const workflowVersion = starterContentSeeds[1];
    if (assetVersion === undefined || workflowVersion === undefined) {
      throw new Error('Seed version missing.');
    }
    expect(assetVersion.assets).toHaveLength(8);
    expect(assetVersion.workflows).toEqual([]);
    expect(workflowVersion.assets).toEqual([]);
    expect(workflowVersion.workflows).toHaveLength(3);
    expect(Object.isFrozen(starterContentSeeds)).toBe(true);
    expect(Object.isFrozen(assetVersion)).toBe(true);
    expect(Object.isFrozen(assetVersion.assets)).toBe(true);
    expect(Object.isFrozen(workflowVersion)).toBe(true);
    expect(Object.isFrozen(workflowVersion.workflows)).toBe(true);

    expect(assetVersion.assets.map(({ id }) => id)).toEqual([
      'locusora:seed:v1:asset:background-mosswood-canopy',
      'locusora:seed:v1:asset:background-rainlit-window',
      'locusora:seed:v1:asset:background-deep-tide',
      'locusora:seed:v1:asset:background-amber-library',
      'locusora:seed:v1:asset:background-starlit-ridge',
      'locusora:seed:v1:asset:ambient-cozy-bedroom-rain',
      'locusora:seed:v1:asset:ambient-lofi-chill',
      'locusora:seed:v1:asset:ambient-healing-bowl',
    ]);
    expect(
      new Set(
        assetVersion.assets.map(({ role }) =>
          assetRoleKey(createAssetRole(role)),
        ),
      ).size,
    ).toBe(8);
  });

  test('loads an extension-local packaged file and preserves its MIME type', async () => {
    const getURL = vi.fn((path: string) => `chrome-extension://id/${path}`);
    const blob = new Blob(['seed'], { type: 'image/webp' });
    const request = vi.fn(() =>
      Promise.resolve(new Response(blob, { status: 200 })),
    );

    await expect(
      loadPackagedSeedFile(
        '/seed/backgrounds/forest.webp',
        { getURL },
        request,
      ),
    ).resolves.toEqual(blob);
    expect(getURL).toHaveBeenCalledWith('seed/backgrounds/forest.webp');
    expect(request).toHaveBeenCalledWith(
      'chrome-extension://id/seed/backgrounds/forest.webp',
    );
  });

  test('rejects a failed packaged response', async () => {
    await expect(
      loadPackagedSeedFile(
        '/seed/missing.webp',
        { getURL: (path) => `chrome-extension://id/${path}` },
        () => Promise.resolve(new Response(null, { status: 404 })),
      ),
    ).rejects.toThrow('Unable to load packaged starter content');
  });
});
