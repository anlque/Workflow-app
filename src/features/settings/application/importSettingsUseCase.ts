import type { Settings } from '../domain/Settings';
import {
  parseSettingsPackage,
  SettingsPackageValidationError,
} from './SettingsPackage';
import type { SettingsRepository } from './SettingsRepository';

export type SettingsImportLimits = Readonly<{ maxFileBytes: number }>;

export async function importSettingsUseCase(
  repository: SettingsRepository,
  data: string,
  limits: SettingsImportLimits,
): Promise<Settings> {
  if (new TextEncoder().encode(data).byteLength > limits.maxFileBytes) {
    throw new SettingsPackageValidationError(
      'Settings package exceeds the configured file size limit.',
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(data) as unknown;
  } catch {
    throw new SettingsPackageValidationError();
  }
  const envelope = parseSettingsPackage(decoded);
  await repository.save(envelope.settings);
  return envelope.settings;
}
