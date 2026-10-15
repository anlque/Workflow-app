import type { AssetKind } from '@/features/assets';

export type StarterAssetSeed = Readonly<{
  key: string;
  kind: AssetKind;
  mimeType: 'audio/ogg' | 'image/webp';
  name: string;
  path: `/seed/${'audio' | 'backgrounds'}/${string}.${'ogg' | 'webp'}`;
  role: string;
}>;

const seed = (definition: StarterAssetSeed): StarterAssetSeed =>
  Object.freeze(definition);

export const starterAssetSeeds: readonly StarterAssetSeed[] = Object.freeze([
  seed({
    key: 'background-mosswood-canopy',
    kind: 'image',
    mimeType: 'image/webp',
    name: 'Mosswood Canopy',
    path: '/seed/backgrounds/mosswood-canopy.webp',
    role: 'Starter background — Mosswood',
  }),
  seed({
    key: 'background-rainlit-window',
    kind: 'image',
    mimeType: 'image/webp',
    name: 'Rainlit Window',
    path: '/seed/backgrounds/rainlit-window.webp',
    role: 'Starter background — Rainlit Window',
  }),
  seed({
    key: 'background-deep-tide',
    kind: 'image',
    mimeType: 'image/webp',
    name: 'Deep Tide',
    path: '/seed/backgrounds/deep-tide.webp',
    role: 'Starter background — Deep Tide',
  }),
  seed({
    key: 'background-amber-library',
    kind: 'image',
    mimeType: 'image/webp',
    name: 'Amber Library',
    path: '/seed/backgrounds/amber-library.webp',
    role: 'Starter background — Amber Library',
  }),
  seed({
    key: 'background-starlit-ridge',
    kind: 'image',
    mimeType: 'image/webp',
    name: 'Starlit Ridge',
    path: '/seed/backgrounds/starlit-ridge.webp',
    role: 'Starter background — Starlit Ridge',
  }),
  seed({
    key: 'ambient-cozy-bedroom-rain',
    kind: 'audio',
    mimeType: 'audio/ogg',
    name: 'Cozy Bedroom Rain',
    path: '/seed/audio/cozy-bedroom-rain.ogg',
    role: 'Starter ambience — Cozy Bedroom Rain',
  }),
  seed({
    key: 'ambient-lofi-chill',
    kind: 'audio',
    mimeType: 'audio/ogg',
    name: 'Lofi Chill',
    path: '/seed/audio/lofi-chill.ogg',
    role: 'Starter ambience — Lofi Chill',
  }),
  seed({
    key: 'ambient-healing-bowl',
    kind: 'audio',
    mimeType: 'audio/ogg',
    name: 'Healing Bowl',
    path: '/seed/audio/healing-bowl.ogg',
    role: 'Starter ambience — Healing Bowl',
  }),
]);
