import { browser } from 'wxt/browser';

import {
  ChromeDocumentPreferenceSource,
  ChromeSettingsRepository,
} from '@/features/settings';

import { createDocumentPreferences } from './DocumentPreferences';

export function createChromeDocumentPreferences() {
  const source = new ChromeDocumentPreferenceSource(
    new ChromeSettingsRepository(),
    browser.storage.onChanged,
  );
  return createDocumentPreferences({
    source,
    root: document.documentElement,
    media: window.matchMedia('(prefers-reduced-motion: reduce)'),
  });
}
