import {
  createSettings,
  defaultSettings,
  type Settings,
} from '../domain/Settings';
import type { SettingsRepository } from './SettingsRepository';

export async function getSettingsUseCase(
  repository: SettingsRepository,
): Promise<Settings> {
  const stored = await repository.load();
  return stored === undefined ? defaultSettings : createSettings(stored);
}
