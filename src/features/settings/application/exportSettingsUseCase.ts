import type { SettingsPackageV1 } from './SettingsPackage';
import type { SettingsRepository } from './SettingsRepository';
import { getSettingsUseCase } from './getSettingsUseCase';

export async function exportSettingsUseCase(
  repository: SettingsRepository,
): Promise<string> {
  const envelope: SettingsPackageV1 = {
    kind: 'locusora/settings',
    version: 1,
    settings: await getSettingsUseCase(repository),
  };
  return JSON.stringify(envelope);
}
