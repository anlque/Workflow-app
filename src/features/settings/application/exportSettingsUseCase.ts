import type { SettingsPackageV2 } from './SettingsPackage';
import type { SettingsRepository } from './SettingsRepository';
import { getSettingsUseCase } from './getSettingsUseCase';

export async function exportSettingsUseCase(
  repository: SettingsRepository,
): Promise<string> {
  const envelope: SettingsPackageV2 = {
    kind: 'locusora/settings',
    version: 2,
    settings: await getSettingsUseCase(repository),
  };
  return JSON.stringify(envelope);
}
