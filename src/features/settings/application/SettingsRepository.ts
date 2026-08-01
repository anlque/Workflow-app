export type SettingsRepository = {
  load(): Promise<unknown>;
  save(value: unknown): Promise<void>;
};
