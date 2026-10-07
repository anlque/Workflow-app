import type { Settings } from '@/features/settings';

export type AudioSettingsPatch = Partial<
  Pick<
    Settings,
    | 'ambientVolumePercent'
    | 'ambientMuted'
    | 'cueVolumePercent'
    | 'cuesMuted'
    | 'muteCuesWithMusic'
  >
>;

export function createAudioSettingsUpdater(dependencies: {
  load(): Promise<Settings>;
  save(settings: Settings): Promise<void>;
}): (patch: AudioSettingsPatch) => Promise<void> {
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
