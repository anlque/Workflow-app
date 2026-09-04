type DocumentPreferencesSnapshot = Readonly<{
  theme: 'system' | 'light' | 'dark';
  reducedMotion: 'system' | 'reduce' | 'no-preference';
  effectiveReducedMotion: boolean;
}>;

export function createTestDocumentPreferences(
  initial: DocumentPreferencesSnapshot = {
    theme: 'system',
    reducedMotion: 'system',
    effectiveReducedMotion: false,
  },
): {
  start(): Promise<void>;
  getSnapshot(): DocumentPreferencesSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
  setSnapshot(snapshot: DocumentPreferencesSnapshot): void;
} {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    start: () => Promise.resolve(),
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
    },
    setSnapshot(next) {
      snapshot = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
