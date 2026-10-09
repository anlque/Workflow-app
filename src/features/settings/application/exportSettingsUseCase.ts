import type { SettingsPackageV3 } from './SettingsPackage';
import type { SettingsRepository } from './SettingsRepository';
import { getSettingsUseCase } from './getSettingsUseCase';

export async function exportSettingsUseCase(
  repository: SettingsRepository,
): Promise<string> {
  const envelope: SettingsPackageV3 = {
    kind: 'locusora/settings',
    version: 3,
    settings: await getSettingsUseCase(repository),
  };
  return JSON.stringify(envelope);
}
