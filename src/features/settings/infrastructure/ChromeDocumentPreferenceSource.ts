import type { DocumentPreferenceSource } from '../application/DocumentPreferenceSource';
import type { ChromeSettingsRepository } from './ChromeSettingsRepository';

type StorageChanges = Record<string, { newValue?: unknown }>;
type StorageChangeListener = (
  changes: StorageChanges,
  areaName: string,
) => void;

export type StorageChangeEvent = Readonly<{
  addListener(listener: StorageChangeListener): void;
  removeListener(listener: StorageChangeListener): void;
}>;

export class ChromeDocumentPreferenceSource implements DocumentPreferenceSource {
  public constructor(
    private readonly repository: ChromeSettingsRepository,
    private readonly changes: StorageChangeEvent,
  ) {}

  public load(): Promise<unknown> {
    return this.repository.load();
  }

  public subscribe(listener: (value: unknown) => void): () => void {
    const onChanged: StorageChangeListener = (changes, areaName) => {
      if (areaName !== 'local' || !Object.hasOwn(changes, 'settings')) return;
      listener(changes['settings']?.newValue);
    };
    this.changes.addListener(onChanged);
    return () => {
      this.changes.removeListener(onChanged);
    };
  }
}
