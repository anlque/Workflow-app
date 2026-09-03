import { createSettings, type Settings } from '../domain/Settings';

export type SettingsPackageV1 = Readonly<{
  kind: 'locusora/settings';
  version: 1;
  settings: Settings;
}>;

export class SettingsPackageValidationError extends Error {
  public constructor(message = 'Settings package is invalid.') {
    super(message);
    this.name = 'SettingsPackageValidationError';
  }
}

export function parseSettingsPackage(value: unknown): SettingsPackageV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SettingsPackageValidationError();
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (
    Object.keys(record).length !== 3 ||
    record['kind'] !== 'locusora/settings' ||
    record['version'] !== 1
  ) {
    throw new SettingsPackageValidationError();
  }
  try {
    return Object.freeze({
      kind: 'locusora/settings',
      version: 1,
      settings: createSettings(record['settings']),
    });
  } catch {
    throw new SettingsPackageValidationError();
  }
}
