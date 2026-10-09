import { createWorkflowId, type WorkflowId } from '@/features/workflow';

export type Theme = 'system' | 'light' | 'dark';
export type ReducedMotion = 'system' | 'reduce' | 'no-preference';

export type Settings = Readonly<{
  theme: Theme;
  reducedMotion: ReducedMotion;
  ambientVolumePercent: number;
  ambientMuted: boolean;
  cueVolumePercent: number;
  cuesMuted: boolean;
  muteCuesWithMusic: boolean;
  backgroundBlurPx: number;
  backgroundBrightnessPercent: number;
  lastSelectedWorkflowId?: WorkflowId;
}>;

export class SettingsValidationError extends Error {
  public constructor() {
    super('Settings are invalid.');
    this.name = 'SettingsValidationError';
  }
}

export const defaultSettings: Settings = Object.freeze({
  theme: 'system',
  reducedMotion: 'system',
  ambientVolumePercent: 100,
  ambientMuted: false,
  cueVolumePercent: 100,
  cuesMuted: false,
  muteCuesWithMusic: false,
  backgroundBlurPx: 0,
  backgroundBrightnessPercent: 100,
});

const baseKeys = ['theme', 'reducedMotion', 'lastSelectedWorkflowId'] as const;
const audioKeys = [
  'ambientVolumePercent',
  'ambientMuted',
  'cueVolumePercent',
  'cuesMuted',
  'muteCuesWithMusic',
] as const;
const appearanceKeys = [
  'backgroundBlurPx',
  'backgroundBrightnessPercent',
] as const;

function isVolumePercent(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 100;
}

export function effectiveAmbientVolume(settings: Settings): number {
  return settings.ambientMuted ? 0 : settings.ambientVolumePercent / 100;
}

export function effectiveCueVolume(settings: Settings): number {
  return settings.cuesMuted ||
    (settings.ambientMuted && settings.muteCuesWithMusic)
    ? 0
    : settings.cueVolumePercent / 100;
}

function parseSettings(
  value: unknown,
  mode: 'auto' | 'legacy' | 'audio' | 'canonical',
): Settings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SettingsValidationError();
  }
  const input = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(input);
  const hasCanonicalAudio = audioKeys.some((key) => Object.hasOwn(input, key));
  const hasCanonicalAppearance = appearanceKeys.some((key) =>
    Object.hasOwn(input, key),
  );
  if (
    (mode === 'canonical' && (!hasCanonicalAudio || !hasCanonicalAppearance)) ||
    (mode === 'audio' && (!hasCanonicalAudio || hasCanonicalAppearance)) ||
    (mode === 'legacy' && (hasCanonicalAudio || hasCanonicalAppearance)) ||
    (hasCanonicalAppearance && !hasCanonicalAudio)
  ) {
    throw new SettingsValidationError();
  }
  const allowedKeys: readonly string[] = hasCanonicalAppearance
    ? [...baseKeys, ...audioKeys, ...appearanceKeys]
    : hasCanonicalAudio
      ? [...baseKeys, ...audioKeys]
      : [...baseKeys, 'volumePercent'];
  if (keys.some((key) => !allowedKeys.includes(key))) {
    throw new SettingsValidationError();
  }
  const theme = input['theme'];
  const reducedMotion = input['reducedMotion'];
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') {
    throw new SettingsValidationError();
  }
  if (
    reducedMotion !== 'system' &&
    reducedMotion !== 'reduce' &&
    reducedMotion !== 'no-preference'
  ) {
    throw new SettingsValidationError();
  }
  const workflowIdValue = input['lastSelectedWorkflowId'];
  if (workflowIdValue !== undefined && typeof workflowIdValue !== 'string') {
    throw new SettingsValidationError();
  }
  let ambientVolumePercent: number;
  let ambientMuted: boolean;
  let cueVolumePercent: number;
  let cuesMuted: boolean;
  let muteCuesWithMusic: boolean;
  if (hasCanonicalAudio) {
    if (
      !audioKeys.every((key) => Object.hasOwn(input, key)) ||
      !isVolumePercent(input['ambientVolumePercent']) ||
      typeof input['ambientMuted'] !== 'boolean' ||
      !isVolumePercent(input['cueVolumePercent']) ||
      typeof input['cuesMuted'] !== 'boolean' ||
      typeof input['muteCuesWithMusic'] !== 'boolean'
    ) {
      throw new SettingsValidationError();
    }
    ambientVolumePercent = input['ambientVolumePercent'];
    ambientMuted = input['ambientMuted'];
    cueVolumePercent = input['cueVolumePercent'];
    cuesMuted = input['cuesMuted'];
    muteCuesWithMusic = input['muteCuesWithMusic'];
  } else {
    const legacyVolume = input['volumePercent'];
    if (legacyVolume !== undefined && !isVolumePercent(legacyVolume)) {
      throw new SettingsValidationError();
    }
    ambientVolumePercent = legacyVolume ?? 100;
    ambientMuted = false;
    cueVolumePercent = legacyVolume ?? 100;
    cuesMuted = false;
    muteCuesWithMusic = false;
  }
  let backgroundBlurPx = defaultSettings.backgroundBlurPx;
  let backgroundBrightnessPercent = defaultSettings.backgroundBrightnessPercent;
  if (hasCanonicalAppearance) {
    const blur = input['backgroundBlurPx'];
    const brightness = input['backgroundBrightnessPercent'];
    if (
      !appearanceKeys.every((key) => Object.hasOwn(input, key)) ||
      !Number.isInteger(blur) ||
      Number(blur) < 0 ||
      Number(blur) > 24 ||
      !Number.isInteger(brightness) ||
      Number(brightness) < 50 ||
      Number(brightness) > 150 ||
      Number(brightness) % 5 !== 0
    ) {
      throw new SettingsValidationError();
    }
    backgroundBlurPx = Number(blur);
    backgroundBrightnessPercent = Number(brightness);
  }
  try {
    const lastSelectedWorkflowId =
      workflowIdValue === undefined
        ? undefined
        : createWorkflowId(workflowIdValue);
    return Object.freeze({
      theme,
      reducedMotion,
      ambientVolumePercent,
      ambientMuted,
      cueVolumePercent,
      cuesMuted,
      muteCuesWithMusic,
      backgroundBlurPx,
      backgroundBrightnessPercent,
      ...(lastSelectedWorkflowId === undefined
        ? {}
        : { lastSelectedWorkflowId }),
    });
  } catch {
    throw new SettingsValidationError();
  }
}

export function createSettings(value: unknown): Settings {
  return parseSettings(value, 'auto');
}

export function createLegacySettings(value: unknown): Settings {
  return parseSettings(value, 'legacy');
}

export function createAudioSettings(value: unknown): Settings {
  return parseSettings(value, 'audio');
}

export function createCanonicalSettings(value: unknown): Settings {
  return parseSettings(value, 'canonical');
}
