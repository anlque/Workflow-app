import { useSyncExternalStore } from 'react';

import type { DocumentPreferences } from './DocumentPreferences';

export function useDocumentPreferences(preferences: DocumentPreferences) {
  return useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  );
}
