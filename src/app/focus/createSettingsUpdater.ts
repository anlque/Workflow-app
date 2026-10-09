import type { Settings } from '@/features/settings';

export type SettingsPatch = Partial<
  Pick<
    Settings,
    | 'theme'
    | 'ambientVolumePercent'
    | 'ambientMuted'
    | 'cueVolumePercent'
    | 'cuesMuted'
    | 'muteCuesWithMusic'
    | 'backgroundBlurPx'
    | 'backgroundBrightnessPercent'
  >
>;

export function createSettingsUpdater(dependencies: {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}): (patch: SettingsPatch) => Promise<void> {
  let queue = Promise.resolve();

  return (patch) => {
    const update = queue.then(async () => {
      const current = await dependencies.load();
      await dependencies.save({ ...current, ...patch });
    });
    queue = update.catch(() => undefined);
    return update;
  };
}
