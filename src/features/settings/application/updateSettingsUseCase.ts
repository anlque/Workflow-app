import { createSettings, type Settings } from '../domain/Settings';
import type { SettingsRepository } from './SettingsRepository';

export async function updateSettingsUseCase(
  repository: SettingsRepository,
  input: unknown,
): Promise<Settings> {
  const settings = createSettings(input);
  await repository.save(settings);
  return settings;
}
