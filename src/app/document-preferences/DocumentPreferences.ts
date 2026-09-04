import {
  createSettings,
  defaultSettings,
  SettingsValidationError,
  type DocumentPreferenceSource,
  type ReducedMotion,
  type Settings,
  type Theme,
} from '@/features/settings';

export type DocumentPreferencesSnapshot = Readonly<{
  theme: Theme;
  reducedMotion: ReducedMotion;
  effectiveReducedMotion: boolean;
}>;

export type DocumentPreferences = Readonly<{
  start(): Promise<void>;
  getSnapshot(): DocumentPreferencesSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}>;

type RootElement = { dataset: Record<string, string | undefined> };
type MotionMedia = {
  matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
};

function parse(value: unknown): Settings {
  if (value === undefined) return defaultSettings;
  try {
    return createSettings(value);
  } catch (error) {
    if (error instanceof SettingsValidationError) return defaultSettings;
    throw error;
  }
}

export function createDocumentPreferences({
  source,
  root,
  media,
}: Readonly<{
  source: DocumentPreferenceSource;
  root: RootElement;
  media: MotionMedia;
}>): DocumentPreferences {
  let settings = defaultSettings;
  let snapshot = resolveSnapshot(settings, media.matches);
  let revision = 0;
  let started: Promise<void> | undefined;
  let disposed = false;
  let unsubscribeSource: (() => void) | undefined;
  let listeningToMedia = false;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        /* isolate subscribers */
      }
    }
  };
  const onMediaChange = () => {
    apply(settings);
  };
  const updateMediaListener = () => {
    const shouldListen = settings.reducedMotion === 'system' && !disposed;
    if (shouldListen === listeningToMedia) return;
    listeningToMedia = shouldListen;
    if (shouldListen) media.addEventListener('change', onMediaChange);
    else media.removeEventListener('change', onMediaChange);
  };
  const apply = (nextSettings: Settings) => {
    if (disposed) return;
    settings = nextSettings;
    updateMediaListener();
    const next = resolveSnapshot(settings, media.matches);
    const changed =
      next.theme !== snapshot.theme ||
      next.reducedMotion !== snapshot.reducedMotion ||
      next.effectiveReducedMotion !== snapshot.effectiveReducedMotion;
    snapshot = changed ? next : snapshot;
    root.dataset['theme'] = snapshot.theme;
    root.dataset['reducedMotion'] = snapshot.effectiveReducedMotion
      ? 'reduce'
      : 'no-preference';
    root.dataset['preferencesReady'] = 'true';
    if (changed) notify();
  };

  return {
    start() {
      if (started !== undefined) return started;
      const loadRevision = revision;
      unsubscribeSource = source.subscribe((value) => {
        revision += 1;
        apply(parse(value));
      });
      started = source.load().then(
        (value) => {
          if (revision === loadRevision) apply(parse(value));
        },
        () => {
          if (revision === loadRevision) apply(defaultSettings);
        },
      );
      return started;
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeSource?.();
      unsubscribeSource = undefined;
      if (listeningToMedia) media.removeEventListener('change', onMediaChange);
      listeningToMedia = false;
      listeners.clear();
    },
  };
}

function resolveSnapshot(
  settings: Settings,
  systemReducedMotion: boolean,
): DocumentPreferencesSnapshot {
  return Object.freeze({
    theme: settings.theme,
    reducedMotion: settings.reducedMotion,
    effectiveReducedMotion:
      settings.reducedMotion === 'reduce' ||
      (settings.reducedMotion === 'system' && systemReducedMotion),
  });
}
