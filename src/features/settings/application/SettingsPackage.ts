import {
  createAudioSettings,
  createCanonicalSettings,
  createLegacySettings,
  type Settings,
} from '../domain/Settings';

export type SettingsPackageV1 = Readonly<{
  kind: 'locusora/settings';
  version: 1;
  settings: unknown;
}>;

export type SettingsPackageV2 = Readonly<{
  kind: 'locusora/settings';
  version: 2;
  settings: Settings;
}>;

export type SettingsPackageV3 = Readonly<{
  kind: 'locusora/settings';
  version: 3;
  settings: Settings;
}>;

export class SettingsPackageValidationError extends Error {
  public constructor(message = 'Settings package is invalid.') {
    super(message);
    this.name = 'SettingsPackageValidationError';
  }
}

export function parseSettingsPackage(value: unknown): Readonly<{
  kind: 'locusora/settings';
  version: 1 | 2 | 3;
  settings: Settings;
}> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SettingsPackageValidationError();
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    Object.keys(record).length !== 3 ||
    record['kind'] !== 'locusora/settings' ||
    (record['version'] !== 1 &&
      record['version'] !== 2 &&
      record['version'] !== 3)
  ) {
    throw new SettingsPackageValidationError();
  }
  try {
    return Object.freeze({
      kind: 'locusora/settings',
      version: record['version'],
      settings:
        record['version'] === 1
          ? createLegacySettings(record['settings'])
          : record['version'] === 2
            ? createAudioSettings(record['settings'])
            : createCanonicalSettings(record['settings']),
    });
  } catch {
    throw new SettingsPackageValidationError();
  }
}
